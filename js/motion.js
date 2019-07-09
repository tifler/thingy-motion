var bluetoothDevice;
var motionRawChar;
var serviceUUID = 'ef680400-9b35-4933-9b10-52ffa9740042';
var motionRawCharUUID = 'ef680406-9b35-4933-9b10-52ffa9740042';

var frames = 0;

function log(msg) {
  console.log(msg);
}

function onConnectMotion() {
  return (bluetoothDevice ? Promise.resolve() : requestDevice())
  .then(connectDeviceAndCacheCharacteristics)
  .then(_ => {
    log('Reading Battery Level...');
    return motionRawChar.readValue();
  })
  .catch(error => {
    log('Argh! ' + error);
  });
}

function requestDevice() {
  log('Requesting any Bluetooth Device...');
  return navigator.bluetooth.requestDevice({
   // filters: [...] <- Prefer filters to save energy & show relevant devices.
      acceptAllDevices: true,
      optionalServices: [serviceUUID]})
  .then(device => {
    bluetoothDevice = device;
    bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
  });
}

function fpsUpdate() {
    document.querySelector('#fps').value = frames;
    frames = 0;
}

function connectDeviceAndCacheCharacteristics() {
  if (bluetoothDevice.gatt.connected && motionRawChar) {
    return Promise.resolve();
  }

  log('Connecting to GATT Server...');
  return bluetoothDevice.gatt.connect()
  .then(server => {
    log('Getting Motion Service...');
    return server.getPrimaryService(serviceUUID);
  })
  .then(service => {
    log('Getting Motion RAW Characteristic...');
    return service.getCharacteristic(motionRawCharUUID);
  })
  .then(characteristic => {
    motionRawChar = characteristic;
    motionRawChar.addEventListener('characteristicvaluechanged',
        handleMotionRawValueChanged);
    document.querySelector('#connectMotion').disabled = true;
    document.querySelector('#startNotifications').disabled = false;
    document.querySelector('#stopNotifications').disabled = true;
    document.querySelector('#reset').disabled = false;
    setInterval(fpsUpdate, 1000);
    onStartNotificationsButtonClick();
  });
}


function swap16(val) {
  return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
}

function cnvtEndian16(v, idx) {
    v.setUint16(0, swap16(v.getUint16(0)));
    return v;
}

/*
 * v: value
 * d: number of bits for decimals
 */
function toFixedPoint(v, d) {
    var mask = (1 << d) - 1;
    return (v >> d).toString(10) + '.' + (v & mask).toString(10);
}

/* This function will be called when `readValue` resolves and
 * characteristic value changes since `characteristicvaluechanged` event
 * listener has been added. */
function handleMotionRawValueChanged(event) {
    var v = event.target.value;

    // accel: 6Q10
    var _ax = cnvtEndian16(v, 0).getInt16(0);
    var ax = toFixedPoint(_ax, 10);
    var _ay = cnvtEndian16(v, 2).getInt16(2);
    var ay = toFixedPoint(_ay, 10);
    var _az = cnvtEndian16(v, 4).getInt16(4);
    var az = toFixedPoint(_az, 10);
    document.querySelector('#ax').value = ax;
    document.querySelector('#ay').value = ay;
    document.querySelector('#az').value = az;

    // gyro: 11Q5
    var _gx = cnvtEndian16(v, 6).getInt16(6);
    var gx = toFixedPoint(_gx, 5);
    var _gy = cnvtEndian16(v, 8).getInt16(8);
    var gy = toFixedPoint(_gy, 5);
    var _gz = cnvtEndian16(v, 10).getInt16(10);
    var gz = toFixedPoint(_gz, 5);
    document.querySelector('#gx').value = gx;
    document.querySelector('#gy').value = gy;
    document.querySelector('#gz').value = gz;

    // compass: 12Q4
    var _cx = cnvtEndian16(v, 12).getInt16(12);
    var cx = toFixedPoint(_cx, 4);
    var _cy = cnvtEndian16(v, 14).getInt16(14);
    var cy = toFixedPoint(_cy, 4);
    var _cz = cnvtEndian16(v, 16).getInt16(16);
    var cz = toFixedPoint(_cz, 4);

    document.querySelector('#cx').value = cx;
    document.querySelector('#cy').value = cy;
    document.querySelector('#cz').value = cz;

    var accel = { x: ax, y: ay, z: az };
    appendAccelData(accel);
    frames += 1;
}

function onStartNotificationsButtonClick() {
  log('Starting Battery Level Notifications...');
  motionRawChar.startNotifications()
  .then(_ => {
    log('> Notifications started');
    document.querySelector('#startNotifications').disabled = true;
    document.querySelector('#stopNotifications').disabled = false;
  })
  .catch(error => {
    log('Argh! ' + error);
  });
}

function onStopNotificationsButtonClick() {
  log('Stopping Battery Level Notifications...');
  motionRawChar.stopNotifications()
  .then(_ => {
    log('> Notifications stopped');
    document.querySelector('#startNotifications').disabled = false;
    document.querySelector('#stopNotifications').disabled = true;
  })
  .catch(error => {
    log('Argh! ' + error);
  });
}

function onResetButtonClick() {
  if (motionRawChar) {
    motionRawChar.removeEventListener('characteristicvaluechanged',
        handleMotionRawValueChanged);
    motionRawChar = null;
  }
  // Note that it doesn't disconnect device.
  bluetoothDevice = null;
  log('> Bluetooth Device reset');
}

function onDisconnected() {
  log('> Bluetooth Device disconnected');
  connectDeviceAndCacheCharacteristics()
  .catch(error => {
    log('Argh! ' + error);
  });
}

function isWebBluetoothEnabled() {
  if (navigator.bluetooth) {
    return true;
  }
  else {
    console.log(
    'Web Bluetooth API is not available.\n' +
        'Please make sure the "Experimental Web Platform features" flag is enabled.');
    return false;
  }
}


