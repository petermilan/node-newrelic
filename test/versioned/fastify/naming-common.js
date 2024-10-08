/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { routesToTest, makeRequest } = require('./common')
require('../../lib/metrics_helper')
const helper = require('../../lib/agent_helper')

module.exports = function createTests(t, getExpectedSegments) {
  routesToTest.forEach((uri) => {
    t.test(`testing naming for ${uri} `, async (t) => {
      const { agent, fastify, calls } = t.context

      agent.on('transactionFinished', (transaction) => {
        calls.test++
        t.equal(
          `WebFrameworkUri/Fastify/GET/${uri}`,
          transaction.getName(),
          `transaction name matched for ${uri}`
        )

        let expectedSegments
        if (helper.isSecurityAgentEnabled(agent)) {
          // since k2 agent adds an onRequest hook
          // it sometimes has timers.setTimeout depending on route
          expectedSegments = [
            `WebTransaction/WebFrameworkUri/Fastify/GET/${uri}`,
            ['Nodejs/Middleware/Fastify/onRequest/<anonymous>', getExpectedSegments(uri)]
          ]
        } else {
          expectedSegments = [
            `WebTransaction/WebFrameworkUri/Fastify/GET/${uri}`,
            getExpectedSegments(uri)
          ]
        }

        t.assertSegments(transaction.trace.root, expectedSegments)
      })

      await fastify.listen({ port: 0 })
      const address = fastify.server.address()
      const result = await makeRequest(address, uri)
      t.equal(result.called, uri, `${uri} url did not error`)
      t.ok(calls.test > 0)
      t.equal(calls.test, calls.middleware, 'should be the same value')
      t.end()
    })
  })

  t.test('should properly name transaction with parameterized routes', async (t) => {
    const { fastify, agent } = t.context

    agent.on('transactionFinished', (transaction) => {
      t.equal(
        transaction.name,
        'WebTransaction/WebFrameworkUri/Fastify/GET//params/:id/:parent/edit'
      )
      t.equal(transaction.url, '/params/id/parent/edit')
    })
    await fastify.listen()
    const address = fastify.server.address()
    const result = await makeRequest(address, '/params/id/parent/edit')
    t.same(result, { id: 'id', parent: 'parent' })
    t.end()
  })
}
