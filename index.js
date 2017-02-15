var argv = require('minimist')(process.argv.slice(2), {
  alias: {
    "destination": "d",
    "origin": "o",
    "waypoint": "w",
    "key": "k"
  }
});

if (!Array.isArray(argv.waypoint))
  argv.waypoint = [argv.waypoint];

var LatLon = require("./lib/geo").LatLon;
var publicConfig = {
  key: argv.k || process.env.GOOGLE_API_KEY,
  stagger_time:       1000, // for elevationPath
  encode_polylines:   false,
  secure:             true // use https
}

var GoogleMapsAPI = require('googlemaps');

var gmAPI = new GoogleMapsAPI(publicConfig);

var directionParams = {
  "origin":    argv.o,
  "destination": argv.d,
  "waypoints": argv.waypoint.join('|')
};

var polyUtil = require('polyline-encoded');

//1203292316,0031698765432,GPRMC,211657.000,A,5213.0247,N,00516.7757,E,0.00,273.30,290312,,,A*62,F,imei:123456789012345,123

var net = require('net');

var client = new net.Socket();
client.connect(10002, '127.0.0.1', function() {
  gmAPI.directions(directionParams, function(err, result) {
    if (err)
      console.log(err);
    else {
      var route = 0;
      var leg = 0;
      var step = -1;

      var lastPoint;
      var nextPoint;
      var currentDistance = 0;
      var desiredSpeed = 80;//kmh
      var intermediateFraction = 0;
      var intervalLength = 2;
      var distancePerInterval = desiredSpeed * 1000 / 3600 * intervalLength;

      var latlngs = [];

      var interval = setInterval(() => {
        if (latlngs.length == 0) {
          if (step < result.routes[route].legs[leg].steps.length - 1) 
            step++; 
          else 
          { 
            step = 0; 
            if (leg < result.routes[route].legs.length - 1) 
              leg++; 
            else 
            { 
              leg = 0; 
              if (route < result.routes.length -1) 
                route++;
              else 
              {
                console.log("done with route");
                process.exit(0);
              }
            } 
          }
          console.log("Loading route", route, "leg", leg, "step", step);
          latlngs = 
          polyUtil.
          decode(result.routes[route].legs[leg].steps[step].polyline.points).
          map(function(coord) { 
            return new LatLon(coord[0], coord[1]); 
          });
        }
        if (lastPoint) {
          intermediateFraction += (distancePerInterval / currentDistance);
          if (intermediateFraction > 1) intermediateFraction = 1;

          if(intermediateFraction >= 1)
          {
            lastPoint = nextPoint;
            nextPoint = latlngs.shift();           
            currentDistance = lastPoint.distanceTo(nextPoint);
            intermediateFraction = 0;
            // try to get closer to desired speed:
            var skips = 0;
            while(currentDistance < distancePerInterval * 0.66 && skips < 5 && latlngs.length > 2) { 
              var skipPoint = nextPoint;
              nextPoint = latlngs.shift();
              currentDistance += skipPoint.distanceTo(nextPoint);
              skips++;
            }
          }
        } else {
          lastPoint = latlngs.shift();
          nextPoint = latlngs.shift();
          currentDistance = lastPoint.distanceTo(nextPoint);
          intermediateFraction = 0;
        }

        if (nextPoint) {
          var coord = lastPoint.intermediatePointTo(nextPoint, intermediateFraction);
          var speed = currentDistance / distancePerInterval * desiredSpeed;
          var t = new Date();
          var gpstime = [
            t.getUTCFullYear().toString().slice(-2),
            ('00' + (t.getUTCMonth() + 1)).slice(-2),
            ('00' + t.getUTCDate()).slice(-2),
            ('00' + t.getUTCHours()).slice(-2),
            ('00' + t.getUTCMinutes()).slice(-2),
            ('00' + t.getUTCSeconds()).slice(-2),
          ]
          console.log("Traveled " + currentDistance + "m, current speed: ", speed.toFixed(1));
          console.log("Sending position", coord);
          var toSend = 
            '(087073819397BR00' + 
            gpstime.slice(0, 3).join('') + 
            'A' + latToDegMinHemi(coord.lat) + 
            lngToDegMinHemi(coord.lon) + 
            ("000" + (speed / 1.852).toFixed(1)).slice(-5) + 
            gpstime.slice(-3).join('') + 
            '000.00,00000000L00000000)';

          console.log("Sending", toSend);
          client.write(toSend);
        }
      }, intervalLength * 1000)
    }
  })
});

client.on('data', function(data) {
  console.log('Received: ' + data);
  client.destroy(); // kill client after server's response
});

client.on('close', function() {
  console.log('Connection closed');
});

function latToDegMinHemi(position) {
  var pos = Math.abs(position);
  var deg = Math.trunc(pos);
  var min = (pos - deg) * 60;
  var degmin = deg * 100 + Math.trunc(min);  
  var minfrac = min - Math.trunc(min);
  var hemi = (position >= 0) ? "N" : "S";
  return ("0000" + degmin).slice(-4) + "." + (Math.round(minfrac*10000) / 10000).toPrecision(4).slice(2,6) + hemi;
}

function lngToDegMinHemi(position) {
  var pos = Math.abs(position);
  var deg = Math.trunc(pos);
  var min = (pos - deg) * 60;
  var degmin = deg * 100 + Math.trunc(min);  
  var minfrac = min - Math.trunc(min);
  var hemi = (position >= 0) ? "E" : "W";
  return ("00000" + degmin).slice(-5) + "." + (Math.round(minfrac*10000) / 10000).toPrecision(4).slice(2,6) + hemi;
}
