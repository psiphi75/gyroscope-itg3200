/*********************************************************************
 *                                                                   *
 *   Copyright 2016 Simon M. Werner                                  *
 *                                                                   *
 *   Licensed to the Apache Software Foundation (ASF) under one      *
 *   or more contributor license agreements.  See the NOTICE file    *
 *   distributed with this work for additional information           *
 *   regarding copyright ownership.  The ASF licenses this file      *
 *   to you under the Apache License, Version 2.0 (the               *
 *   "License"); you may not use this file except in compliance      *
 *   with the License.  You may obtain a copy of the License at      *
 *                                                                   *
 *      http://www.apache.org/licenses/LICENSE-2.0                   *
 *                                                                   *
 *   Unless required by applicable law or agreed to in writing,      *
 *   software distributed under the License is distributed on an     *
 *   "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY          *
 *   KIND, either express or implied.  See the License for the       *
 *   specific language governing permissions and limitations         *
 *   under the License.                                              *
 *                                                                   *
 *********************************************************************/

'use strict';

// The datasheet documentation for the ITG 3200 can be found here:
//     https://www.sparkfun.com/datasheets/Sensors/Gyro/PS-ITG-3200-00-01.4.pdf

var GYRO_ADDRESS = 0x68;

var GYRO_RESET_ADDRESS = 0x3E;

// Power management register: refer to page 27 of datasheet
var GYRO_RESET_BYTE = 0x80;

// Set the digital low pass filter (DLPF) settings: refer to pg 24
var GYRO_DLPF_ADDRESS = 0x16;
var GYRO_DLPF_VALUE = (0x03 << 3) + 0x00;   // (FS_SEL << 3) + DLPF_CFG
var GYRO_DEFAULT_F_INTERNAL = 8000;

// Sample rate divider: use default value 0x00 for full range: refer to pg 23
var GYRO_SAMPLERATE_ADDRESS = 0x15;
var GYRO_DEFAULT_F_SAMPLE = 100; // Choose default of 100 ms

// gyro full scale range: refer to pg 24
var GYRO_DEGREES_ADDRESS = 0x16;
var GYRO_DEGREES_VALUE = 0x18;

var GYRO_READ_ADDRESS = 0x1B;
var GYRO_READ_LEN = 8;

var GYRO_SENSITIVITY = 14.375;

// 280 is the sensitivity. refer to pg 7 section temperature sensor.
var TEMP_OFFSET = 13200; // (35 - 13200 / 280);
var TEMP_SENSITIVITY = 280;
var TEMP_OFFSET_CELCIUS = 35;

/**
 * Initalise the gyroscope.
 * @param {number}  i2cBusNum The i2c bus number.
 * @param {object}  options   The additional options.
 *
 * Options:
 *   i2c: the i2c library (such that we don't have to load it twice).
 *   sampleRate:  The sample Rate in milliseconds.
 */
function Gyroscope(i2cBusNum, options) {

    if (typeof i2cBusNum !== 'number') {
        throw new Error('Gyroscope: i2cBusNum must be a number.');
    }

    if (!options) {
        options = {};
    }
    this.i2c = (options.i2c || require('i2c-bus')).openSync(i2cBusNum);
    this.sampleRate = options.sampleRate || GYRO_DEFAULT_F_SAMPLE;

    try {

        // Reset the device
        this.i2c.writeByteSync(GYRO_ADDRESS, GYRO_RESET_ADDRESS, GYRO_RESET_BYTE);

        // Set the sample rate
        this.i2c.writeByteSync(GYRO_ADDRESS, GYRO_SAMPLERATE_ADDRESS, calcSampleRateDivisor(this.sampleRate));

        // Set the digital low pass filter value
        this.i2c.writeByteSync(GYRO_ADDRESS, GYRO_DLPF_ADDRESS, GYRO_DLPF_VALUE);

        // Set the degrees value
        this.i2c.writeByteSync(GYRO_ADDRESS, GYRO_DEGREES_ADDRESS, GYRO_DEGREES_VALUE);

    } catch (ex) {
        console.error('Gyroscope(): there was an error initialising: ', ex);
    }

}


/**
 * Get the values from the gyroscope.
 * @param  {Function} callback The standard callback -> (err, {temp: number, x:number, y:number, z:number})
 */
Gyroscope.prototype.getValues = function (callback) {

    if (typeof this.calibrationOffset === 'undefined') {
        console.error('WARNING: Gyroscope.getValues(): The gyroscrope has not yet been calibrated.');
        this.calibrationOffset = {
            x: 0,
            y: 0,
            z: 0
        };
    }

    var buf = new Buffer(GYRO_READ_LEN);
    var self = this;
    try {
        this.i2c.readI2cBlock(GYRO_ADDRESS, GYRO_READ_ADDRESS, GYRO_READ_LEN, buf, i2cCallback);
    } catch (ex) {
        console.error('ERROR: Gyroscope.getValues(): there was an error in reading i2c: ', ex);
        if (callback) {
            callback(ex);
            callback = null;
        }
    }

    function i2cCallback(err) {

        if (err) {
            callback(err);
        } else {

            var bt1 = buf[0];
            var bt0 = buf[1];
            var bx1 = buf[2];
            var bx0 = buf[3];
            var by1 = buf[4];
            var by0 = buf[5];
            var bz1 = buf[6];
            var bz0 = buf[7];

            var result = {
                temp: ((((bt1 & 0x0f) << 8) | bt0) + TEMP_OFFSET) / TEMP_SENSITIVITY - TEMP_OFFSET_CELCIUS,
                x: convertBytes(bx0, bx1, self.calibrationOffset.x, GYRO_SENSITIVITY),
                y: convertBytes(by0, by1, self.calibrationOffset.y, GYRO_SENSITIVITY),
                z: convertBytes(bz0, bz1, self.calibrationOffset.z, GYRO_SENSITIVITY)
            };

            callback(null, result);
        }
        callback = null;

    }

};


/**
 * Calibrate the gyroscope.  Before the gyro is used it should be calibrated, this needs to
 * be done when it is still.
 * @param  {Function} callback The standard callback -> (err, {x:number, y:number, z:number})
 */
Gyroscope.prototype.calibrate = function (callback) {
    this.calibrationOffset = {
        x: 0,
        y: 0,
        z: 0
    };
    var xAve = 0;
    var yAve = 0;
    var zAve = 0;
    var MAX_COUNT = 5;
    var count = 0;
    var self = this;
    var fnInt = setInterval(function () {
        self.getValues(function(err, values) {
            if (err) {
                callback(err);
                clearInterval(fnInt);
                return;
            }
            xAve += values.x;
            yAve += values.y;
            zAve += values.z;
            count += 1;
            if (count >= MAX_COUNT) {
                self.calibrationOffset = {
                    x: -(xAve / count),
                    y: -(yAve / count),
                    z: -(zAve / count)
                };
                callback(null, self.calibrationOffset);
                clearInterval(fnInt);
            }
        });
    }, 50);
};


/**
 * Convert the bytes to actual values.
 * @param  {number} byteLo       The first byte.
 * @param  {number} byteHi       The second byte.
 * @param  {number} offset      The offset value.
 * @param  {number} sensitivity The sensitivity.
 * @return {number}             The actual value.
 */
function convertBytes(byteLo, byteHi, offset, sensitivity) {

    // add the two bytes together (bit-shift x1)
    var byteVal;

    if (byteHi > 15) {
        byteHi = byteHi & 0x0F;                         // don't count the first 4 bits
        byteVal = (byteLo + (byteHi << 8)) - 0x0FFF;    // Make the value negative
    } else {
        byteVal = byteLo + (byteHi << 8);
    }

    return offset + (byteVal / sensitivity);
}


/**
 * Calculate the divisor for the ITG 3200 based on a default sample rate.  This
 * reverse engineering of the divider (see section 8.2 on pg 23 of
 * ITG 3200 speification documentation).
 *
 * @param  {number} sampleRate The sampleRate in milliseconds
 * @return {number}            The divisor
 */
function calcSampleRateDivisor(sampleRate) {
    var divisor = GYRO_DEFAULT_F_INTERNAL * sampleRate / 1000 - 1;
    if (divisor < 0) {
        console.error('Gyroscope::calcSampleRateDivisor(): sampleRate value is too small: ', sampleRate);
        return 0;
    }
    if (divisor > 255) {
        return 255;
    }
    return Math.floor(divisor);
}


module.exports = Gyroscope;
