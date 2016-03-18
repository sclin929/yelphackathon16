#!/usr/bin/env node

var http = require('http');
var express = require('express');
var app = express();

// For parsing the request body
app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.static('static'));
});

// Listen on port 3000 unless otherwise specified
app.set('port', process.env.port || 3000);

// View for application
app.get('/', function(req, res) {
  res.sendfile(__dirname + 'main.html');
});

http.createServer(app).listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});