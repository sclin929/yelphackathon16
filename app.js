#!/usr/bin/env node

var http = require('http');
var oauthSig = require('oauth-signature');
var n = require('nonce')();
var qs = require('querystring');
var _ = require('lodash');
var request = require('request');
var async = require('async');
var express = require('express');
var app = express();

// Constant variables
var HTTP_GET = 'GET';
var YELP_SEARCH_URL = 'https://api.yelp.com/v2/search';
var SEARCH_LIMIT = 20;

// For parsing the request body
app.use(express.static(__dirname + '/static'));

// Listen on port 3000 unless otherwise specified
app.set('port', process.env.port || 3000);

// Default view for application
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/main.html');
});

// Uses Yelp's Search API to retrieve restaurants in geographical region
app.get('/findRestaurants', function(req, res) {
  var results = {total: 0, businesses: []};

  var searchBounds = req.query.swLat + ',' + req.query.swLng + '|' 
                      + req.query.neLat + ',' + req.query.neLng;
  var offset = req.query.offset;
  var searchUrl = createSearchUrl(searchBounds, offset);

  request(searchUrl, function(err, response, body) {
    if (!err && res.statusCode === 200) {
      parsedJson = JSON.parse(body);
      var numBusinesses = parsedJson.total;
      results.total = numBusinesses;

      // Calculate the number of API calls needed to retrieve all 
      // restaurants and create objects as needed to store info
      var numCalls = Math.ceil(numBusinesses/20);
      numCalls = (numCalls > 50) ? 50 : numCalls;   /* Set result limit to be 1000 */
      var searchDict = [];
      var searchResults = {}; // Index to array of business JSONs

      for (var i = 0; i < numCalls; i++) {
        var offset = i * SEARCH_LIMIT;
        var searchUrl = {index: i, 
                         url: createSearchUrl(searchBounds, offset)};
        searchDict.push(searchUrl);
        searchResults[i] = null;
      }

      // Make asynchronous calls to Yelp API
      async.each(searchDict, function(search, callback) {
        var index = search.index;
        callSearchApi(search.url, index, searchResults, callback);

      }, function(err) {
        if (err) {
          error = 'Error finding restaurants: ' + err + '\n';
          console.error(error);

        } else {
          // results.businesses has an array with all the business JSONs
          Object.keys(searchResults).forEach(function(key) {
            results.businesses = results.businesses.concat(searchResults[key]);
          });

          res.send(results);
        }
      });

    } else {
      error = 'Error finding restaurants: ' + err + '\n';
      error = 'Response code ' + response.statusCode + '\n';
      console.error(error);
    }
  });
});

function callSearchApi(searchUrl, index, searchResults, callback) {
  request(searchUrl, function(err, response, body) {
    if (!err && response.statusCode === 200) {
      var parsedJson = JSON.parse(body);
      var parsedBusinesses = parsedJson.businesses;
      searchResults[index] = parsedBusinesses;
    } else {
      error = 'Error finding restaurants: ' + err + '\n';
      if (response !== undefined) {
        error = 'In callSearchApi. Response code ' 
                    + response.statusCode + '\n';
      }
      console.error(error);
    }

    callback();
  });
}

function createSearchUrl(searchBounds, offset) {
  var oauthParams = {
    oauth_consumer_key: process.env.c_key,
    oauth_token: process.env.token,
    oauth_nonce: n(),
    oauth_timestamp: n().toString().substr(0,10),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_version: '1.0'
  }

  var searchParams = {
    term: 'food',
    category_filter: 'restaurants',
    bounds: searchBounds
  };

  if (offset != 0) {
    searchParams.offset = offset;
  }

  var cSecret = process.env.c_secret;
  var tSecret = process.env.t_secret;

  var params = _.assign(searchParams, oauthParams);
  var signature = oauthSig.generate(HTTP_GET, YELP_SEARCH_URL, 
                    params, cSecret, tSecret, {encodeSignature: false});

  params.oauth_signature = signature;

  var searchUrl = YELP_SEARCH_URL + '?' + qs.stringify(params);
  return searchUrl
}

http.createServer(app).listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});