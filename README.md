# homebridge-tado-smart-thermostat

## ⚠️ Deprecation notice - plugin archived

Due to lack of time, this plugin will no longer be maintained. If you are locking for an alternative, I would highly suggest to try out [homebridge-tado-platform](https://github.com/SeydX/homebridge-tado-platform), which has a huge feature set, support for Config UI X and much more.

## About

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

## Hotwater

Each hotwater zone in the Tado app is exposed to HomeKit as a switch.

## Global Features

* Possibility to expose occupancy sensors for all Tado users
* Possibility to expose the global Home/Away state as occupancy sensor with controls.

**Hint**: If you want to use the global Home/Away state and settings, make sure to set the Auto-Assist mode correctly in the config. If you have Auto-Assist on, security system controls are added to the occupancy sensor, so that you can set the manual override state (security system states: "At home", "Away") or the auto mode of Tado (security system state: "Off"). If you don't have a Tado subscription with Auto-Assist, a switch is added to the occupancy sensor to set the mode to home (switch state: "On") or away (switch state: "Off").

## Installation

Install the plugin via npm:

```bash
npm install -g homebridge-tado-smart-thermostat
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
            "areOccupancySensorsEnabled": false,
            "isGlobalHomeAwayEnabled": false,
            "isAutoAssistEnabled": false,
            "areWindowSensorsHidden": false,
            "switchToAutoInNextTimeBlock": false,
            "isAlternativeStateLogicEnabled": false,
            "zoneUpdateInterval": 3600,
            "stateUpdateInterval": 60,
            "occupancyUpdateInterval": 60,
            "homeUpdateInterval": 60,
            "isApiEnabled": false,
            "apiPort": 40810,
            "apiToken": "<YOUR-TOKEN>",
            "zones": [
                {
                    "zoneId": <YOUR-ZONE-ID>,
                    "zoneName": "<YOUR-ZONE-NAME>",
                    "terminationOption": "auto"
                }
            ]
        }
    ]
}
```

**username**: The user name that you use for the app and the web app of Tado.

**password**: The password that you use for the app and the web app of Tado.

**homeName**: The name of the home you want to expose to HomeKit as written in the Tado app. Has to be the exact same name as in the web app of Tado.

**areOccupancySensorsEnabled** (optional): Determines whether occupancy sensors are exposed for the Tado users. Defaults to `false`.

**isGlobalHomeAwayEnabled** (optional): Determines whether the global Home/Away state is exposed as occupancy sensor with controls to HomeKit. Defaults to `false`.

**isAutoAssistEnabled** (optional): Determines whether you have the Tado "Auto-Assist" for automatic geo-fencing booked and enabled. Only used when `isGlobalHomeAwayEnabled` is set to `true`. Defaults to `false`.

**areWindowSensorsHidden** (optional): By default, windows sensors are shown if window detection is enabled for their zones. Use this settings to completely hide them. Defaults to `false`.

**switchToAutoInNextTimeBlock** (optional): If set to `true`, the state of the zone is switch back to AUTO in the next time block of the time table (same behavior as the zone setting for manual changes on the device itself). Defaults to `false`.

**isAlternativeStateLogicEnabled** (optional): If set to `true`, a different logic is used for displaying the target state of the thermostate (AUTO, HEAT, OFF). This alternative logic shows the target state as OFF if the thermostat is set to OFF by Tado automation. Defaults to `false`.

**zoneUpdateInterval** (optional): The polling interval in seconds, at which the zone is updated (used for battery state updates). Defaults to 1 hour.

**stateUpdateInterval** (optional): The polling interval in seconds, at which the state of a thermostat is updated. Defaults to 60 seconds.

**occupancyUpdateInterval** (optional): The polling interval in seconds, at which the state of the occupancy sensors is updated. Only used when `areOccupancySensorsEnabled` is set to `true`. Defaults to 60 seconds.

**homeUpdateInterval** (optional): The polling interval in seconds, at which the state of the home is updated. Only used when `isGlobalHomeAwayEnabled` is set to `true`. Defaults to 60 seconds.

**isApiEnabled** (optional): Enables an HTTP API for controlling Tado zones. Defaults to `false`. See **API** for more information.

**apiPort** (optional): The port that the API (if enabled) runs on. Defaults to `40810`, please change this setting of the port is already in use.

**apiToken** (optional): The token that has to be included in each request of the API. Is required if the API is enabled and has no default value.

**zones** (optional): If you wish to override the default termination (until next automatic change, until cancelled by user or a timer) for a particular zone, add each zone by ID (IDs are printed in the log during Homebridge startup) with terminationOption of "auto", "manual" or the number of minutes the change should last. Zone Name is purely for readability.

## API

This plugin also provides an HTTP API to control some features of the Tado system. It has been created so that you can further automate the system with HomeKit shortcuts. Starting with iOS 13, you can use shortcuts for HomeKit automation. Those automations that are executed on the HomeKit coordinator (i.e. iPad, AppleTV or HomePod) also support HTTP requests, which means you can automate your Tado system without annoying switches and buttons exposed in HomeKit.

If the API is enabled, it can be reached at the specified port on the host of this plugin. 
```
http://<YOUR-HOST-IP-ADDRESS>:<apiPort>
```

The token has to be specified as value of the `Authorization` header on each request:
```
Authorization: <YOUR-TOKEN>
```

You can get the IDs of all zones by looking at Homebridge logs.

### API - Get values of Tado zone

Use the `zones/<ZONE-ID>/<PROPERTY-NAME>` endpoint to retrieve a single value of a Tado zone. The HTTP method has to be `GET`:
```
http://<YOUR-HOST-IP-ADDRESS>:<apiPort>/zones/<ZONE-ID>/<PROPERTY-NAME>
```

The response is a plain text response (easier to handle in HomeKit shortcuts), the following property names are supported:

* **target-state** The target state of the zone (possible values: `auto`, `manual`, `off`)
* **target-temperature** The target temperature of the zone as numeric value (range: `5-25`)

Use the `zones/<ZONE-ID>` endpoint to retrieve all values of a Tado zone. The HTTP method has to be `GET`:
```
http://<YOUR-HOST-IP-ADDRESS>:<apiPort>/zones/<ZONE-ID>
```

The response is a JSON object containing all values:
```
{
    "target-state": "manual",
    "target-temperature": 20
}
```

### API - Set values of Tado zone

Use the `zones/<ZONE-ID>` endpoint to set values of a Tado zone. The HTTP method has to be `POST`:
```
http://<YOUR-HOST-IP-ADDRESS>:<apiPort>/zones/<ZONE-ID>
```

The body of the request has to be JSON containing the new values:
```
{
    "<PROPERTY-NAME>": <VALUE>
}
```
Multiple properties can be set with one request.

The following property names are supported:

* **target-state** The target state of the zone (possible values: `auto`, `manual`, `off`)
* **target-temperature** The target temperature of the zone as numeric value (range: `5-25`)
