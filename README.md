# gyroscope-itg3200

Library to run the ITG 3200 3-axis gyroscope via the i2c bus.  It has tested on the BeagleBone Series, but it should also work for the Raspberry Pi.  One thing about the ITG 3200 is that also has a temperature sensor, this library returns the temperature.

### Install:

```bash
npm install gyroscope-itg3200
```

### Using it:

```javascript
var Gyroscope = require('gyroscope-itg3200');

// The initialiser is the i2c bus number that the accelerometer is on.
var gyro = new Gyroscope(2);

// Get the gyro values
gyro.getValues(function (err, values) {
    console.log(values);
});
```

In the above code `values` has the following format:
```javascript
{ temp: 23.942857142857143,     // The Temperature in degrees Celsius
  x: -0.27826086956521723,      // The x Gyro in degrees per second.
  y: -0.0417391304347825,       // The y Gyro in degrees per second.
  z: -0.11130434782608692 }     // The z Gyro in degrees per second.
```

### Calibration

The Gyroscope requires calibration each time it is used.  The calibration process requires the gyroscope to be at rest.  It will calibrate using 5 data points over a short period of time.

```javascript
gyro.calibrate(function () {
    console.log('Gyro calibrated and ready to use.');
});
```

# Further reading
- [Technical documentation (datasheet) for the ITG 3200](https://www.sparkfun.com/datasheets/Sensors/Gyro/PS-ITG-3200-00-01.4.pdf)

# To Do for v1.0.0
- Save the calibration values for the future, such that calibration is not required each time.
- [Implement noise reduction](http://stackoverflow.com/questions/1638864/filtering-accelerometer-data-noise).
- **Done**: The Temperature value being returned are buggy.  Need to fix.
- **Done:** Make the sample rate configurable - currently set at maximum rate (which may not be efficient for all purposes).


## License

Copyright 2016 Simon M. Werner

Licensed to the Apache Software Foundation (ASF) under one or more contributor license agreements.  See the NOTICE file distributed with this work for additional information regarding copyright ownership.  The ASF licenses this file to you under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.  You may obtain a copy of the License at

  [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the License for the specific language governing permissions and limitations under the License.
