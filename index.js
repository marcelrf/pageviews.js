/**
 * Copyright 2015 Thomas Steiner (@tomayac). All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var request = require('request');
var package = require('./package.json');

// Enable or disable debug mode
var DEBUG = true;

// The Pageviews base URL
var BASE_URL = 'https://wikimedia.org/api/rest_v1';

// The user agent to use
var USER_AGENT = 'pageviews.js–v' + package.version + ' (' +
    package.repository.url + ')';

var pageviews = (function() {

  var _access = {
    default: 'all-access',
    allowed: ['all-access', 'desktop', 'mobile-web', 'mobile-app']
  };

  var _agent = {
    default: 'all-agents',
    allowed: ['all-agents', 'user', 'spider', 'bot']
  };

  var _granularity = {
  default: 'daily',
    allowed: ['daily']
  };

  /**
   * Checks the input parameters for validity.
   */
  var _checkParams = function(params, caller) {
    if (!params) {
      return new Error('Required parameters missing.');
    }
    // Required: project
    if ((!params.project) || (params.project.indexOf('.') === -1)) {
      return new Error('Required parameter "project" missing or invalid.');
    }
    // Required: article
    if ((caller === 'getPerArticlePageviews') && (!params.article)) {
      return new Error('Required parameter "article" missing.');
    }
    if (caller === 'getPerArticlePageviews') {
      // Required: start
      if ((!params.start) ||
          (!/^(?:19|20)\d\d[- /.]?(?:0[1-9]|1[012])[- /.]?(?:0[1-9]|[12][0-9]|3[01])$/.test(params.start))) {
        return new Error('Required parameter "start" missing or invalid.');
      }
      // Required: end
      if ((!params.end) ||
          (!/^(19|20)\d\d[- /.]?(0[1-9]|1[012])[- /.]?(0[1-9]|[12][0-9]|3[01])$/.test(params.end))) {
        return new Error('Required parameter "end" missing or invalid.');
      }
    } else if (caller === 'getAggregatedPageviews') {
      // Required: start
      if ((!params.start) ||
          (!/^(?:19|20)\d\d[- /.]?(?:0[1-9]|1[012])[- /.]?(?:0[1-9]|[12][0-9]|3[01])[- /.]?(?:[012][0-9])$/.test(params.start))) {
        return new Error('Required parameter "start" missing or invalid.');
      }
      // Required: end
      if ((!params.end) ||
          (!/^(19|20)\d\d[- /.]?(0[1-9]|1[012])[- /.]?(0[1-9]|[12][0-9]|3[01])[- /.]?(?:[012][0-9])$/.test(params.end))) {
        return new Error('Required parameter "end" missing or invalid.');
      }
    }
    if (caller === 'getTopPageviews') {
      // Required: year
      if ((!params.year) || (!/^(?:19|20)\d\d$/.test(params.year))) {
        return new Error('Required parameter "year" missing or invalid.');
      }
      // Required: month
      if ((!params.month) || (!/^(?:0[1-9]|1[012])$/.test(params.month))) {
        return new Error('Required parameter "month" missing or invalid.');
      }
      // Required: day
      if ((!params.day) || (!/^(?:0[1-9]|[12][0-9]|3[01])$/.test(params.day))) {
        return new Error('Required parameter "day" missing or invalid.');
      }
      if ((params.limit) && !/^\d+$/.test(params.limit) &&
          (0 < params.limit) && (params.limit <= 1000)) {
        return new Error('Invalid optional parameter "limit".');
      }
    }
    // Optional: access
    if ((params.access) && (_access.allowed.indexOf(params.access) === -1)) {
      return new Error('Invalid optional parameter "access".');
    }
    // Optional: agent
    if ((params.agent) && (_agent.allowed.indexOf(params.agent) === -1)) {
      return new Error('Invalid optional parameter "agent".');
    }
    // Optional: granularity
    if ((params.granularity) &&
        (_granularity.allowed.indexOf(params.granularity) === -1)) {
      return new Error('Invalid optional parameter "granularity".');
    }
    return params;
  };

  /**
   * Checks the results for validity, in case of success returns the parsed
   * data, else returns the error details.
   */
  var _checkResult = function(error, response, body) {
    var data;
    if (error || response.statusCode !== 200) {
      if (error) {
        return error;
      }
      if (response.statusCode === 404) {
        try {
          data = JSON.parse(body);
          return new Error(data.detail);
        } catch (e) {
          return new Error(e);
        }
      }
      return new Error('Status code ' + response.statusCode);
    }
    try {
      data = JSON.parse(body);
    } catch (e) {
      return new Error(e);
    }
    return data;
  };

  return {
    /**
     * This is the root of all pageview data endpoints. The list of paths that
     * this returns includes ways to query by article, project, top articles,
     * etc. If browsing the interactive documentation, see the specifics for
     * each endpoint below.
     */
    getPageviewsDimensions: function() {
      return new Promise(function(resolve, reject) {
        var options = {
          url: BASE_URL + '/metrics/pageviews/',
          headers: {
            'User-Agent': USER_AGENT
          }
        };
        DEBUG && console.log(JSON.stringify(options, null, 2));
        request(options, function(error, response, body) {
          var result = _checkResult(error, response, body);
          if (result.stack) {
            return reject(result);
          }
          return resolve(result);
        });
      });
    },

    /**
     * Given a Mediawiki article and a date range, returns a daily timeseries of
     * its pageview counts. You can also filter by access method and/or agent
     * type.
     */
    getPerArticlePageviews: function(params) {
      return new Promise(function(resolve, reject) {
        params = _checkParams(params, 'getPerArticlePageviews');
        if (params.stack) {
          return reject(params);
        }
        // Required params
        var project = params.project;
        var article = encodeURIComponent(params.article.replace(/\s/g, '_'));
        var start = params.start;
        var end = params.end;
        // Optional params
        var access = params.access ? params.access : _access.default;
        var agent = params.agent ? params.agent : _agent.default;
        var granularity = params.granularity ?
            params.granularity : _granularity.default;

        var options = {
          url: BASE_URL + '/metrics/pageviews/per-article' +
              '/' + project +
              '/' + access +
              '/' + agent +
              '/' + article +
              '/' + granularity +
              '/' + start +
              '/' + end,
          headers: {
            'User-Agent': USER_AGENT
          }
        };
        DEBUG && console.log(JSON.stringify(options, null, 2));
        request(options, function(error, response, body) {
          var result = _checkResult(error, response, body);
          if (result.stack) {
            return reject(result);
          }
          return resolve(result);
        });
      });
    },

    /**
     * Given a date range, returns a timeseries of pageview counts. You can
     * filter by project, access method and/or agent type. You can choose
     * between daily and hourly granularity as well.
     */
    getAggregatedPageviews: function(params) {
      return new Promise(function(resolve, reject) {
        params = _checkParams(params, 'getAggregatedPageviews');
        if (params.stack) {
          return reject(params);
        }
        // Required params
        var project = params.project;
        var start = params.start;
        var end = params.end;
        // Optional params
        var access = params.access ? params.access : _access.default;
        var agent = params.agent ? params.agent : _agent.default;
        var granularity = params.granularity ?
            params.granularity : _granularity.default;
        var options = {
          url: BASE_URL + '/metrics/pageviews/aggregate' +
              '/' + project +
              '/' + access +
              '/' + agent +
              '/' + granularity +
              '/' + start +
              '/' + end,
          headers: {
            'User-Agent': USER_AGENT
          }
        };
        DEBUG && console.log(JSON.stringify(options, null, 2));
        request(options, function(error, response, body) {
          var result = _checkResult(error, response, body);
          if (result.stack) {
            return reject(result);
          }
          return resolve(result);
        });
      });
    },

    /**
     * Lists the 1000 most viewed articles for a given project and timespan
     * (year, month or day). You can filter by access method.
     */
    getTopPageviews: function(params) {
      return new Promise(function(resolve, reject) {
        params = _checkParams(params, 'getTopPageviews');
        if (params.stack) {
          return reject(params);
        }
        // Required params
        var project = params.project;
        var year = params.year;
        var month = params.month;
        var day = params.day;
        var limit = params.limit || false;
        // Optional params
        var access = params.access ? params.access : _access.default;
        var options = {
          url: BASE_URL + '/metrics/pageviews/top' +
              '/' + project +
              '/' + access +
              '/' + year +
              '/' + month +
              '/' + day,
          headers: {
            'User-Agent': USER_AGENT
          }
        };
        DEBUG && console.log(JSON.stringify(options, null, 2));
        request(options, function(error, response, body) {
          var result = _checkResult(error, response, body);
          if (result.stack) {
            return reject(result);
          }
          if (limit) {
            result.items[0].articles = result.items[0].articles.slice(0, limit);
          }
          return resolve(result);
        });
      });
    }
  };
})();

module.exports = pageviews;