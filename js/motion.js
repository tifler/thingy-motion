var bluetoothDevice;
var motionRawChar;
var gravityVectorChar;
const serviceUUID = 'ef680400-9b35-4933-9b10-52ffa9740042';
const motionRawCharUUID = 'ef680406-9b35-4933-9b10-52ffa9740042';
const gravityVectorCharUUID = 'ef68040a-9b35-4933-9b10-52ffa9740042';
const configCharUUID = 'ef680401-9b35-4933-9b10-52ffa9740042';

var config = {};
var frames = {};

function log(msg) {
    console.log(msg);
}

function swap16(val) {
    return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
}

function swap32(val) {
    return ((val & 0xFF) << 24)
            | ((val & 0xFF00) << 8)
            | ((val >> 8) & 0xFF00)
            | ((val >> 24) & 0xFF);
}

function cnvtEndian32(v, idx) {
    // console.log('+ ' + v.getUint32(idx).toString(16));
    v.setUint32(idx, swap32(v.getUint32(idx)));
    // console.log('- ' + v.getUint32(idx).toString(16));
    return v;
}

function cnvtEndian16(v, idx) {
    v.setUint16(idx, swap16(v.getUint16(idx)));
    return v;
}

/******************************************************************************/

function onConnectMotion() {
    return (bluetoothDevice ? Promise.resolve() : requestDevice())
    .then(setupNotification)
    .catch(error => {
        log('Argh! ' + error);
    });
}

function onGetConfig(v) {
    config.value = v;
    config.stepCntItv = cnvtEndian16(v, 0).getUint16(0);
    config.tempCompItv = cnvtEndian16(v, 2).getUint16(2);
    config.magCompItv = cnvtEndian16(v, 4).getUint16(4);
    config.motProcFreq = cnvtEndian16(v, 6).getUint16(6);
    config.wakeOnMotion = v.getUint8(8);
    log(config);

    document.querySelector('#stepCntItv').value = config.stepCntItv;
    document.querySelector('#tempCompItv').value = config.tempCompItv;
    document.querySelector('#magCompItv').value = config.magCompItv;
    document.querySelector('#motProcFreq').value = config.motProcFreq;
    document.querySelector('#wakeOnMotion').value = config.wakeOnMotion;
}

function onApplyButtonClick() {
    config.stepCntItv = document.querySelector('#stepCntItv').value;
    config.tempCompItv = document.querySelector('#tempCompItv').value;
    config.magCompItv = document.querySelector('#magCompItv').value;
    config.motProcFreq = document.querySelector('#motProcFreq').value;
    config.wakeOnMotion = document.querySelector('#wakeOnMotion').value;

    config.value.setUint16(0, config.stepCntItv);
    cnvtEndian16(config.value, 0);
    config.value.setUint16(2, config.tempCompItv);
    cnvtEndian16(config.value, 2);
    config.value.setUint16(4, config.magCompItv);
    cnvtEndian16(config.value, 4);
    config.value.setUint16(6, config.motProcFreq);
    cnvtEndian16(config.value, 6);
    config.value.setUint8(8, config.wakeOnMotion);

    configChar.writeValue(config.value);
}

function onGravityVectorChanged(event) {
    var v = event.target.value;
    var vector = {};

    vector.x = cnvtEndian32(v, 0).getFloat32(0);
    vector.y = cnvtEndian32(v, 4).getFloat32(4);
    vector.z = cnvtEndian32(v, 8).getFloat32(8);

    document.querySelector('#vx').value = vector.x;
    document.querySelector('#vy').value = vector.y;
    document.querySelector('#vz').value = vector.z;

    // log(vector);

    appendGravityVectorData(vector);
    frames.v += 1;
}

function setupNotification() {
    log('Connecting to GATT Server...');
    return bluetoothDevice.gatt.connect()
    .then(server => {
        log('Getting Motion Service...');
        return server.getPrimaryService(serviceUUID);
     })
    .then(service => {
        log('Getting Characteristics...');
        return service.getCharacteristics();
    })
    .then(characteristics => {
        characteristics.forEach(char => {
            if (char.uuid == motionRawCharUUID) {
                log('Found Motion Raw Characteristic');
                motionRawChar = char;
                motionRawChar.addEventListener('characteristicvaluechanged', onMotionRawValueChanged);
                log(motionRawChar);
            }
            else if (char.uuid  == gravityVectorCharUUID) {
                log('Found Gravity Vector Characteristic');
                gravityVectorChar = char;
                gravityVectorChar.addEventListener('characteristicvaluechanged', onGravityVectorChanged);
                log(gravityVectorChar);
            }
            else if (char.uuid == configCharUUID) {
                log('Found Config Characteristic');
                configChar = char;
                configChar.readValue()
                .then(value => {
                    onGetConfig(value);
                })
            }
        });

        document.querySelector('#connectMotion').disabled = true;
        document.querySelector('#startNotifications').disabled = false;
        document.querySelector('#stopNotifications').disabled = true;
        document.querySelector('#reset').disabled = false;
        setInterval(fpsUpdate, 1000);
        onStartNotificationsButtonClick();
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
    document.querySelector('#afps').value = frames.a;
    document.querySelector('#gfps').value = frames.g;
    document.querySelector('#cfps').value = frames.c;
    document.querySelector('#vfps').value = frames.v;
    frames.a = frames.g = frames.c = frames.v = 0;
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
        motionRawChar.addEventListener('characteristicvaluechanged', onMotionRawValueChanged);
        document.querySelector('#connectMotion').disabled = true;
        document.querySelector('#startNotifications').disabled = false;
        document.querySelector('#stopNotifications').disabled = true;
        document.querySelector('#reset').disabled = false;
        setInterval(fpsUpdate, 1000);
        onStartNotificationsButtonClick();
    });
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
function onMotionRawValueChanged(event) {
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
    var gyro = { x: gx, y: gy, z: gz };
    appendGyroData(gyro);
    var compass = { x: cx, y: cy, z: cz };
    appendCompassData(compass);
    frames.a += 1;
    frames.g += 1;
    frames.c += 1;
}

function onStartNotificationsButtonClick() {
    log('Starting Notifications...');
    motionRawChar.startNotifications()
    .then(_ => {
        log('> Motion Raw Notifications started');
    })
    .catch(error => {
        log('Argh! ' + error);
    });

    gravityVectorChar.startNotifications()
    .then(_ => {
        log('> Gravity Vector Notifications started');
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
        log('> Motion Raw Notifications stopped');
    })
    .catch(error => {
        log('Argh! ' + error);
    });

    gravityVectorChar.stopNotifications()
    .then(_ => {
        log('> Gravity Vector Notifications stopped');
        document.querySelector('#startNotifications').disabled = false;
        document.querySelector('#stopNotifications').disabled = true;
    })
    .catch(error => {
        log('Argh! ' + error);
    });
}

function onResetButtonClick() {
    if (motionRawChar) {
        motionRawChar.removeEventListener('characteristicvaluechanged', onMotionRawValueChanged);
        motionRawChar = null;
    }
    if (gravityVectorChar) {
        gravityVectorChar.removeEventListener('characteristicvaluechanged', onGravityVectorChanged);
        gravityVectorChar = null;
    }
    // Note that it doesn't disconnect device.
    bluetoothDevice = null;
    log('> Bluetooth Device reset');
}

function onDisconnected() {
    log('> Bluetooth Device disconnected');
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
