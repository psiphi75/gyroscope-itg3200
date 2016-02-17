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

var GYRO_ADDRESS = 0x68;

var GYRO_RESET_ADDRESS = 0x3E;
var GYRO_RESET_BYTE = 0x80;

var GYRO_SAMPLERATE_ADDRESS = 0x15;
var GYRO_SAMPLERATE_DIVIDER = 0x00;

var GYRO_DEGREES_ADDRESS = 0x16;
var GYRO_DEGREES_VALUE = 0x18;      // Default

var GYRO_READ_ADDRESS = 0x1B;
var GYRO_READ_LEN = 8;

/**
 * Initalise the gyroscope.
 * @param {number}   i2cBusNum The i2c bus number.
 */
function Gyroscope(i2cBusNum) {

    if (typeof i2cBusNum !== 'number') {
        throw new Error('Gyroscope: i2cBusNum must be a number.');
    }

    this.i2c = require('i2c-bus').openSync(i2cBusNum);

    // Reset the device
    this.i2c.writeByteSync(GYRO_ADDRESS, GYRO_RESET_ADDRESS, GYRO_RESET_BYTE);

    // Set the sample rate
    this.i2c.writeByteSync(GYRO_ADDRESS, GYRO_SAMPLERATE_ADDRESS, GYRO_SAMPLERATE_DIVIDER);

    // Set the degrees value
    this.i2c.writeByteSync(GYRO_ADDRESS, GYRO_DEGREES_ADDRESS, GYRO_DEGREES_VALUE);

}


/**
 * Get the raw (unscaled) values from the compass.
 * @param  {Function} callback The standard callback -> (err, {x:string, y:string, z:string})
 */
Gyroscope.prototype.getValues = function (callback) {
    var buf = new Buffer(GYRO_READ_LEN);
    this.i2c.readI2cBlock(GYRO_ADDRESS, GYRO_READ_ADDRESS, GYRO_READ_LEN, buf, function (err2) {
        if (err2) {
            callback(err2);
            return;
        }

        var bt1 = buf[0];
        var bt0 = buf[1];
        var bx1 = buf[2];
        var bx0 = buf[3];
        var by1 = buf[4];
        var by0 = buf[5];
        var bz1 = buf[6];
        var bz0 = buf[7];

        var result = {
            temp: convertBytes(bt0, bt1, 82.143, 280),
            x: convertBytes(bx0, bx1, 20.8, 14.375),
            y: convertBytes(by0, by1, -1, 14.375),
            z: convertBytes(bz0, bz1, -0.4, 14.375)
        };

        callback(null, result);
    });

};


/**
 * Convert the bytes to actual values.
 * @param  {number} byte0       The first byte.
 * @param  {number} byte1       The second byte.
 * @param  {number} offset      The offset value.
 * @param  {number} sensitivity The sensitivity.
 * @return {number}             The actual value.
 */
function convertBytes(byte0, byte1, offset, sensitivity) {

    // add the two bytes together (bit-shift x1)
    var val = byte0 + (byte1 << 8);

    // if we have a negative byte value
    if (byte1 > 15) {

        // don't count the first 4 bits
        byte1 = byte1 & 0x0F;
        val = (byte0 + (byte1 << 8)) + 1;
        val = -val;
    }
    return offset + (val / sensitivity);
}


module.exports = Gyroscope;
