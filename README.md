# homebridge-tado

This project is a homebridge plugin for Tado heating devices. Each zone (i.e. room) in the Tado app is exposed to HomeKit as a thermostat.

The reason for development of the plugin is that the native Tado HomeKit support does not differentiate between AUTO mode and MANUAL mode. If you change the target temperature in HomeKit, Tado always switches to MANUAL mode. 

## Thermostat

Each zone in the Tado app is exposed to HomeKit as a thermostat with the following features:
* Current mode: OFF, HEATING, AUTO
* Target mode: OFF, HEATING, AUTO
* Current temperature
* Target temperature
* Current humidity
* Battery warning
* Window state: CLOSED, OPEN (only visible if the open window detection is enabled for the zone)

## Installation

Install the plugin via npm:

```bash
npm install https://github.com/lukasroegner/homebridge-tado.git -g
```

## Configuration

```json
{
    "platforms": [
        {
            "platform": "TadoPlatform",
            "username": "<YOUR-USER-NAME>",
            "password": "<YOUR-PASSWORD>",
            "homeName": "<YOUR-HOME-NAME>",
            "switchToAutoInNextTimeBlock": false,
            "zoneUpdateInterval": 3600,
            "stateUpdateInterval": 60
        }
    ]
}
```

**username**: The user name that you use for the app and the web app of Tado.

**password**: The password that you use for the app and the web app of Tado.

**homeName**: The name of the home you want to expose to HomeKit as written in the Tado app.

**switchToAutoInNextTimeBlock** (optional): If set to `true`, the state of the zone is switch back to AUTO in the next time block of the time table (same behavior as the zone setting for manual changes on the device itself). Defaults to `false`.

**zoneUpdateInterval** (optional): The polling interval in seconds, at which the zone is updated (used for battery state updates). Defaults to 1 hour.

**stateUpdateInterval** (optional): The polling interval in seconds, at which the state of a thermostat is updated. Defaults to 60 seconds.
