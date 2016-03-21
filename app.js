#!/usr/bin/env node

var http = require('http');
var oauthSig = require('oauth-signature');
var n = require('nonce')();
var qs = require('querystring');
var _ = require('lodash');
var request = require('request');
var express = require('express');
var app = express();

// Constant variables
var HTTP_GET = 'GET';
var YELP_SEARCH_URL = 'https://api.yelp.com/v2/search';

// For parsing the request body
app.use(express.static(__dirname + '/static'));

// Listen on port 3000 unless otherwise specified
app.set('port', process.env.port || 3000);

// Default view for application
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/main.html');
});

// Uses Yelp's Search API to retrieve
app.get('/findRestaurants', function(req, res) {
  var swLat = req.query.swLat;
  var swLng = req.query.swLng;
  var neLat = req.query.neLat;
  var neLng = req.query.neLng;
  
  var searchBounds = swLat + ',' + swLng + '|' + neLat + ',' + neLng;

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
    offset: req.query.offset,
    bounds: searchBounds
  };

  var cSecret = process.env.c_secret;
  var tSecret = process.env.t_secret;

  var params = _.assign(searchParams, oauthParams);

  var signature = oauthSig.generate(HTTP_GET, YELP_SEARCH_URL, 
                    params, cSecret, tSecret, {encodeSignature: false});
  params.oauth_signature = signature;

  var paramUrl = qs.stringify(params);
  var searchApiUrl = YELP_SEARCH_URL + '?' + paramUrl;
  
  request(searchApiUrl, function(err, response, body) {
    if (!err && res.statusCode === 200) {
      res.send(JSON.parse(body));

    } else {
      error = 'Error finding restaurants: ' + err + '\n';
      error = 'Response code ' + response.statusCode + '\n';
      console.error(error);
    }
  });
});

http.createServer(app).listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});