/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../lib/agent_helper')
const DatastoreShim = require('../../../lib/shim/datastore-shim')
const ParsedStatement = require('../../../lib/db/parsed-statement')
const tests = require('../../lib/cross_agent_tests/datastores/datastore_instances')

tap.test('Datastore instance metrics collected via the datastore shim', function (t) {
  t.autoend()
  t.beforeEach(function (t) {
    t.context.agent = helper.loadMockedAgent()
  })

  t.afterEach(function (t) {
    const { agent } = t.context
    if (agent) {
      helper.unloadAgent(agent)
    }
  })

  tests.forEach(function (test) {
    t.test(test.name, function (t) {
      const { agent } = t.context
      agent.config.getHostnameSafe = function () {
        return test.system_hostname
      }

      const shim = new DatastoreShim(agent, 'testModule', null)
      shim.setDatastore(test.product)

      const testInstrumented = {
        query: function () {}
      }
      shim.recordOperation(testInstrumented, 'query', function () {
        let dbHost = test.db_hostname
        if (!dbHost && (test.unix_socket || test.database_path)) {
          dbHost = 'localhost'
        }
        // If any value is provided for a path or port, it must be used.
        // Otherwise use 'default'.
        let port = 'default'
        if (
          test.hasOwnProperty('unix_socket') ||
          test.hasOwnProperty('database_path') ||
          test.hasOwnProperty('port')
        ) {
          port = test.unix_socket || test.database_path || test.port
        }
        return {
          parameters: {
            host: dbHost,
            port_path_or_id: port
          }
        }
      })

      helper.runInTransaction(agent, function (tx) {
        testInstrumented.query()

        tx.end()
        t.ok(getMetrics(agent).unscoped[test.expected_instance_metric])
        t.end()
      })
    })
  })
})

tap.test('Datastore instance metrics captured through the segment', function (t) {
  t.autoend()
  t.beforeEach(function (t) {
    t.context.agent = helper.loadMockedAgent()
  })

  t.afterEach(function (t) {
    const { agent } = t.context
    if (agent) {
      helper.unloadAgent(agent)
    }
  })

  tests.forEach(function (test) {
    t.test(test.name, function (t) {
      const { agent } = t.context
      agent.config.getHostnameSafe = function () {
        return test.system_hostname
      }

      helper.runInTransaction(agent, function (tx) {
        const ps = new ParsedStatement(test.product, 'SELECT', 'bar')
        const child = tx.trace.root.add('test segment', ps.recordMetrics.bind(ps))

        // Each instrumentation must make the following checks when pulling
        // instance attributes from their respective drivers.

        // If we don't have a host name specified, but are connecting over the
        // file system using either a domain socket or a path to the db file
        // then the database host is localhost.
        let dbHost = test.db_hostname
        if (!dbHost && (test.unix_socket || test.database_path)) {
          dbHost = 'localhost'
        }

        // If any value is provided for a path or port, it must be used.
        // Otherwise use 'default'.
        let port = 'default'
        if (
          test.hasOwnProperty('unix_socket') ||
          test.hasOwnProperty('database_path') ||
          test.hasOwnProperty('port')
        ) {
          port = test.unix_socket || test.database_path || test.port
        }

        child.captureDBInstanceAttributes(dbHost, port, 'foo')
        child.touch()

        tx.end()
        t.ok(getMetrics(agent).unscoped[test.expected_instance_metric])
        t.end()
      })
    })
  })
})

function getMetrics(agent) {
  return agent.metrics._metrics
}
