"use strict";
/* globals root_path: false, _: true, async: true*/

// Set working path to root
process.chdir(__dirname);
GLOBAL.root_path = process.cwd();

// Load libs
var fs = require('fs-extra');
var path = require('path');
var async = require('async');
var Decompress = require('decompress');
var glob = require('glob');
var Download = require('download');
var progress = require('download-status');
var _ = require('lodash');
var csv = require('csv');

// Load underscore.strings addon
_.mixin(require('underscore.string').exports());

// Extend _ with features
_.mixin({
    scale: function(x, fromLow, fromHigh, toLow, toHigh) {
        return (x - fromLow) * (toHigh - toLow) /
            (fromHigh - fromLow) + toLow;
    },
    compactObject: function(o) {
        _.each(o, function(v, k) {
            if (v === undefined || v === null)
                delete o[k];
        });
        return o;
    }
});

// Setup the importer
var Importer = function() {
    var scope = this;

    // Set Open Datas sources to use
    scope.sources = [{
        archive: 'ratp_gtfs_lines.zip',
        name: 'ratp_gtfs_lines',
        url: 'http://dataratp.download.opendatasoft.com/RATP_GTFS_LINES.zip'
    }, {
        archive: 'bus_icons.zip',
        name: 'bus_icon',
        url: 'http://data.ratp.fr/?eID=ics_od_datastoredownload&file=76'
    }, {
        archive: 'rail_icons.zip',
        name: 'rail_icons',
        url: 'http://data.ratp.fr/?eID=ics_od_datastoredownload&file=93'
    }];

    // Where downloaded files are stored
    scope.rawPath = root_path + '/raw/';

    // Where downloaded files are extracted
    scope.extractPath = root_path + '/extract/';

    // Where file will be builded
    scope.buildPath = root_path + '/build/';

    // Build process
    scope.upgrade = function(next) {
        async.eachSeries(
            [
                scope.downloadSources,
                scope.extractSources,
                scope.build
            ],
            function(fn, next) {
                fn(next);
            },
            function() {
                console.log('Full upgrade is complete !');
                if (_.isFunction(next)) next();
            }
        );
    };

    // Build process
    scope.build = function(next) {
        async.eachSeries(
            [
                scope.buildClean,
                scope.buildIcons,
                scope.buildStations
            ],
            function(fn, next) {
                fn(next);
            },
            function() {
                console.log('Build is complete !');
                if (_.isFunction(next)) next();
            }
        );
    };


    // Download a fresh version of open datas sources
    scope.downloadSources = function(next) {

        // Remove the old raw directory
        fs.removeSync(scope.rawPath);

        // Setup download manager
        var download = new Download();

        // Add files to download
        _.each(scope.sources, function(src) {
            download.get({
                url: src.url,
                name: src.archive
            }, scope.rawPath);
        });

        // Add Progress display plugin
        download.use(progress());

        // Start to run the downloads
        download.run(function(err, files) {
            if (_.isFunction(next)) next(err, files);
        });

        // Return instance
        return scope;

    };

    // Extract sources
    scope.extractSources = function(next) {

        // Remove the old extract directory
        fs.removeSync(scope.extractPath);

        // Find all Zip files in raw path and decompress them
        async.eachSeries(_.values(scope.sources), function(src, next) {

                // Get the archive path
                var archive = scope.rawPath + src.archive;
                var extractPath = scope.extractPath + src.name;

                console.log("---", src, archive);

                // Setup Decompress to dedicated dir
                var decompress = new Decompress()
                    .src(archive)
                    .dest(extractPath)
                    .use(Decompress.zip({
                        strip: 1
                    }));

                // Decompress and get callback
                decompress.decompress(function() {

                    // Get files in path
                    glob('*.zip', {
                        cwd: extractPath,
                    }, function(err, files) {

                        // If zip file found, extract it and then remove zip file
                        async.eachSeries(files, function(file, next) {

                            // Get paths
                            var filePath = extractPath + '/' + file;
                            var fileName = path.basename(file, path.extname(file));

                            // Logging
                            console.log('[ ] Uncompress : ' + filePath);

                            // Decompress files
                            var _d = new Decompress()
                                .src(filePath)
                                .dest(extractPath + '/' + fileName)
                                .use(Decompress.zip({
                                    strip: 1
                                }));
                            _d.decompress(function() {
                                console.log('[*] Complete : ' + filePath);
                                console.log('[ ] Remove : ' + filePath);
                                fs.removeSync(filePath);
                                console.log('[*] Removed : ' + filePath);
                                next();
                            });

                        }, next);
                    });

                });

            },

            // When all is extracted
            function(err) {
                if (err) console.log(err);
                if (_.isFunction(next)) next(err);
                console.log('All is extracted ! ');
            }
        );

        // Return instance
        return scope;

    };

    // Clean build directory
    scope.buildClean = function(next) {

        // Remove the old extract directory
        fs.removeSync(scope.buildPath);

        // Go next 
        if (_.isFunction(next)) next();

        // Return instance
        return scope;

    };

    // Build icons
    scope.buildIcons = function(next) {
        var extractPath = scope.extractPath;

        glob('**/*.png', {
            cwd: extractPath,
        }, function(err, files) {

            async.eachSeries(files,

                // For each icon
                function(file, next) {

                    // Bus icons are not prefixed, so prefix them be recognizing the path
                    var isBus = /^bus_icon/.test(file);

                    // Build icon name
                    var icon_name = _.slugify(((isBus ? 'bus_' : '') + path.basename(file, path.extname(file)).replace(/(enRVB|genRVB|-genRVB|-gen-rvb)/gi, '')));

                    // Some adjustements
                    icon_name = icon_name.replace(/bus-noct-/, 'bus-n');
                    icon_name = icon_name.replace(/^t\-/, 'tram-t');
                    icon_name = icon_name.replace(/^m\-/, 'subway-');

                    // Copy original to build name
                    fs.copy(extractPath + '/' + file, scope.buildPath + '/icons/' + icon_name + path.extname(file), next);

                },

                // When all is done
                function(err) {
                    if (err) console.log(err);
                    if (_.isFunction(next)) next(err);
                }
            );

        });

        // Return instance
        return scope;
    };

    // Build lines stations
    scope.buildStations = function(next) {

        var extractPath = scope.extractPath + 'ratp_gtfs_lines';
        var iconsPath = scope.buildPath + 'icons/';
        var stations = [];
        var duplicated = {};
        var noImages = [];

        glob('**/stops.txt', {
            cwd: extractPath,
        }, function(err, files) {

            async.eachSeries(files,

                // For each stops file
                function(file, next) {

                    // Get CSV content
                    var datas = fs.readFileSync(extractPath + '/' + file, 'utf8');

                    // Get type and number of the station
                    var match = /RATP_GTFS_(.*)_(.*)\//;
                    var matches = match.exec(file);

                    // Init station object
                    var station = {
                        type: 'station',
                        subtype: ((matches ? matches[1] : '').toLowerCase()).replace(/metro/, 'subway'),
                        lineNumber: (matches ? matches[2] : '').toLowerCase(),
                    };

                    // Try to get the icon from lineNumber
                    console.log(iconsPath, station.subtype, station.lineNumber);
                    var icon = _.first(glob.sync('' + station.subtype + '-' + station.lineNumber + "*.png", {
                        cwd: iconsPath
                    }));


                    // var icon = iconsPath+station.subtype+'-'+station.lineNumber+'.png'; 
                    // var iconExists = fs.existsSync(icon); 

                    console.log(icon);

                    // If found, set icon to station, else exit for debugging
                    if (icon && icon.length) station.icon = icon;
                    else {
                        // console.log(file);

                        noImages.push({
                            icon: station.subtype + '-' + station.lineNumber,
                            file: file
                        });
                        // process.exit(10);
                    }


                    console.log(file);

                    // Parse CSV to get infos
                    csv.parse(datas, function(err, data) {

                        // Parse CSV and kill station object
                        var keys = data.shift();
                        _.each(data, function(val) {

                            // Create object from keys and val
                            var d = _.object(keys, val);

                            // Setup station vars
                            station.center = {
                                lat: d.stop_lat,
                                lng: d.stop_lon
                            };
                            station.title = _.humanize(d.stop_name);
                            station.infos = _.humanize(d.stop_desc);
                            station.openDataID = d.stop_id;

                            // Check if station is not yet documented
                            var fingerPrint = station.title + '-' + station.center.lat + '-' + station.center.lng;
                            if (!duplicated[fingerPrint]) {

                                // Remember the fingerprint
                                duplicated[fingerPrint] = true;

                                // Add station to output stations array
                                stations.push(_.clone(station, true));
                                console.log(station);
                            }

                        });

                        // Go next next
                        next();

                    });

                },

                // When all is done
                function(err) {
                    if (err) console.log(err);
                    if (_.isFunction(next)) next(err);

                    // Display stations with no images
                    console.log('--------------------------');
                    console.log('Stations with no images : ');
                    console.log(noImages);
                    console.log('--------------------------');

                    // Build stations lists
                    var list;

                    // BUS 
                    list = _.filter(stations, function(s) {
                        return s.subtype === 'bus';
                    });
                    fs.outputFileSync(scope.buildPath + 'stations/bus.json', JSON.stringify(list));

                    // SUBWAY 
                    list = _.filter(stations, function(s) {
                        return s.subtype === 'subway';
                    });
                    fs.outputFileSync(scope.buildPath + 'stations/subway.json', JSON.stringify(list));

                    // TRAM 
                    list = _.filter(stations, function(s) {
                        return s.subtype === 'tram';
                    });
                    fs.outputFileSync(scope.buildPath + 'stations/tram.json', JSON.stringify(list));

                    // ALL
                    fs.outputFileSync(scope.buildPath + 'stations/all.json', JSON.stringify(stations));

                    // Log how many stations found
                    console.log(stations.length + ' stations found ! ');
                }
            );

        });

        // Return instance
        return scope;

    };

    // Return instance
    return scope;

};

// Create a new Importer
var importer = new Importer();

// Depends on arguments
if (process.argv[2] === '--upgrade') importer.upgrade();
else if (!process.argv[2] || process.argv[2] === '--build') importer.build();
