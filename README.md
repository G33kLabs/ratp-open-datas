RATP OPEN DATAS IMPORT
======================

This script will download a fresh version of RATP OpenDatas and build json files for all known stations.

THIS IS NOT A FULL IMPLEMENTATION, ONLY TRANSPORT TYPE, LINE NUMBER, NAME, GEOLOCATION AND ICON FOR EACH STATION.

THIS SCRIPT IS MADE TO BE STANDALONE. OUTPUT PATHS ARE NOT CONFIGURABLE FOR MOMENT.

A LAST ONE FOR THE DAY : the 'openDataID' could be not revealant because I remove duplicated latitude/longitude stations. A futher version will include them as alias.

Output Files
------------

build/icons/*.png : all icons files
build/stations/bus.json : only bus stations
build/stations/subway.json : only subway stations
build/stations/tram.json : only tram stations
build/stations/all.json : all stations

The format for each station is :

```
{
    "type": "station",
    "subtype": "subway",
    "lineNumber": "1",
    "icon": "subway-1.png",
    "center": {
        "lat": "48.84811123157566",
        "lng": "2.3980040127977436"
    },
    "title": "Nation",
    "infos": "Nation (terre plein face au 3 place de la) 75112",
    "openDataID": "2371"
}
```

Source Files 
------------

Offre transport de la RATP - format GTFS (full datas for each line)
wget "http://dataratp.download.opendatasoft.com/RATP_GTFS_LINES.zip"

Indices des lignes de bus du réseau RATP (icons)
wget "http://data.ratp.fr/?eID=ics_od_datastoredownload&file=76" -O bus_icons.zip

Indices et couleurs de lignes du réseau ferré RATP (icons)
wget "http://data.ratp.fr/?eID=ics_od_datastoredownload&file=93" -O rail_icons.zip


Installation
------------

clone this repository
decompress
go to created directory
Install nodejs dependencies by typing ``npm install``


Update Datas
------------

Will download and extract fresh files in 'raw' directory.
Will also run 'build' after.

```
npm run upgrade
```


Build Datas
-------------

Only if you have already download the sources zip files.
Rebuild stations files and icons.

```
npm run build
```

ToDO
----

A lot of things !

 + Turn this script into a npm module and then be able to integrate it in your project workflow
 + Add progress bars while generating
 + Include Routes and Timing from calendar for each transport line
 + Considering json output a little bite verbosing, perhaps csv could be a lighter solution for size
 + Make plugins to allow developers to include other datas providers and output