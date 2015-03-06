'use strict';

var express = require('express');
var request = require('request');
var Q       = require('q');
var _       = require('lodash');
var dirty   = require('dirty');
var moment  = require('moment-timezone');

// Time zone for calculating "X hours ago"
moment().tz("America/New_York").format();

var port = process.env.PORT || 9005;
var app  = express();
var db   = dirty(__dirname + '/dirty.db');

// pass through public directory
app.use('/public', express.static(__dirname + "/public"));

var usernames = (process.env.GITHUB_USERNAMES || 'bgun,github').split(',');
var cache_delay = 300; // seconds before recache

// replacement values
var tokens = {
  gh_base      : 'https://api.github.com/',
  client_id    : process.env.GITHUB_CLIENT_ID,
  client_secret: process.env.GITHUB_CLIENT_SECRET
};

// super simple string formatter
var formatString = function(str, tokens) {
  _.each(tokens, function(v, k) {
    str = str.replace('{{'+k+'}}', v);
  });
  //console.log("Formatted",str);
  return str;
};

// GitHub endpoints
var endpoints = {
  user : '{{gh_base}}users/{{username}}',
  repos: '{{gh_base}}users/{{username}}/repos'
};

var authParams = '?'+[
  'client_id={{client_id}}',
  'client_secret={{client_secret}}'
].join('&');

var makeRequest = function(type, username) {
  var tk = _.extend({
    username: username
  }, tokens);
  var options = {
    url: formatString(endpoints[type]+authParams, tk),
    headers: {
      'User-Agent': 'bgun'
    }
  };
  console.log(options.url);
  return options;
};

var getUser = function(username) {
  console.log("Getting user",username);
  var deferred = Q.defer();
  request.get(makeRequest('user', username), function(error, resp, body) {
    if (!error && resp.statusCode == 200) {
      var data = JSON.parse(body);
      deferred.resolve(data);
    } else {
      deferred.reject('Failed to get user: '+username);
    }
  });
  return deferred.promise;
};

var getLastUpdatedRepoForUser = function(username) {
  var deferred = Q.defer();
  request.get(makeRequest('repos', username), function(error, resp, body) {
    if (!error && resp.statusCode == 200) {
      var data = JSON.parse(body);
      if(data.length > 0) {
        data = _.sortBy(data, 'pushed_at').reverse();
        //console.log(username+' success');
        deferred.resolve(data[0]);
      } else {
        //console.log(username+' has no repos');
        deferred.resolve({});
      }
    } else {
      //console.log(username+' failed', resp.statusCode);
      deferred.reject('failed');
    }
  });
  return deferred.promise;
};

var getCachedData = function() {

    db.set('john', {eyes: 'blue'});
    console.log('Added john, he has %s eyes.', db.get('john').eyes);

    db.set('bob', {eyes: 'brown'}, function() {
      console.log('User bob is now saved on disk.')
    });

    db.forEach(function(key, val) {
      console.log('Found key: %s, val: %j', key, val);
    });
};

var getData = function(expired, now) {
  var deferred = Q.defer();
  var user_promises;
  var repo_promises;

  if(!expired) {
    console.log("Loading from cache");
    deferred.resolve(db.get('users'));
  } else {
    console.log("Loading from live");
    user_promises = _.map(usernames, function(n) {
      return getUser(n);
    });
    repo_promises = _.map(usernames, function(n) {
      return getLastUpdatedRepoForUser(n);
    });
    // fire all the things!
    Q.all(user_promises)
      .then(function(users) {

        Q.all(repo_promises)
          .then(function(repos) {

            var output = _(repos)
              .map(function(r, i) {
                return _.extend({
                  username: usernames[i],
                  pushed_at   : r.pushed_at ? r.pushed_at : '',
                  last_pushed : r.pushed_at ? moment(r.pushed_at).calendar() : 'Never'
                }, {
                  avatar   : users[i].avatar_url,
                  name     : users[i].name || 'unknown',
                  home_url : users[i].html_url
                });
              })
              .sortBy('pushed_at')
              .reverse()
              .value();

            db.set('updated', now);
            db.set('users',   output);

            console.log("Returning live data, "+output.length+" users");

            deferred.resolve(output);
          })
          .catch(function(msg) {
            throw new Error("Error in repo:",msg);
          })
          .done();
      })
      .catch(function(msg) {
        throw new Error("Error in users:",msg);
      })
      .done();
  }

  return deferred.promise;
};



// Express routes

app.get('/', function(req, res) {
  res.sendFile(__dirname+'/public/html/index.html');
});

app.get('/data', function(req, res) {
  var now = new Date().getTime();
  var updated = db.get('updated') || 0;
  var since_cache = (now - updated) / 1000;
  var cache_expires = cache_delay - since_cache;
  var force = req.query.force ? true : false;
  var expired = force || cache_expires < 0;

  getData(expired, now)
    .then(function(data) {
      var end = new Date().getTime();
      res.send({
        updated       : updated,
        elapsed       : end - now,     // how long did the request take?
        cache_expires : cache_expires, // seconds to expire
        used_cache    : !expired,
        users         : data
      });
    })
    .catch(function(msg) {
      console.log("Error in route:",msg);
    })
    .done();
});



// initialize node-dirty

console.log("Initializing database");
db.on('load', function() {
  console.log("Starting server on port "+port);
  app.listen(port);
});
db.on('drain', function() {
  console.log("All records written to disk");
});
