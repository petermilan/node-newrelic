/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const getCLMMeta = require('../../../lib/util/code-level-metrics')
const { anon, arrow, named } = require('../../lib/clm-helper')
const path = require('path')
const helperPath = path.resolve(`${__dirname}/../../lib/clm-helper.js`)
const sinon = require('sinon')

tap.test('CLM Meta', (t) => {
  t.autoend()

  t.test('should return function name as code.function from function reference', (t) => {
    function testFunction() {}
    const meta = getCLMMeta(testFunction)
    t.same(meta, {
      'code.filepath': __filename,
      'code.function': 'testFunction',
      'code.lineno': 19
    })
    t.end()
  })

  t.test('should return variable name as code.function from function reference', (t) => {
    const testFunction = function () {}
    const meta = getCLMMeta(testFunction)
    t.same(meta, {
      'code.filepath': __filename,
      'code.function': 'testFunction',
      'code.lineno': 30
    })
    t.end()
  })

  t.test(
    'should return function name not variable name as code.function from function reference',
    (t) => {
      const meta = getCLMMeta(named)
      t.same(meta, {
        'code.filepath': helperPath,
        'code.function': 'testFunction',
        'code.lineno': 11
      })
      t.end()
    }
  )

  t.test('should return anonymous as code.function from anonymous function reference', (t) => {
    const meta = getCLMMeta(anon)
    t.same(meta, {
      'code.filepath': helperPath,
      'code.function': 'anonymous',
      'code.lineno': 9
    })
    t.end()
  })

  t.test('should return anonymous as code.function from arrow function reference', (t) => {
    const meta = getCLMMeta(arrow)
    t.same(meta, {
      'code.filepath': helperPath,
      'code.function': 'anonymous',
      'code.lineno': 10
    })
    t.end()
  })

  t.test('should only return code.function if retrieving function metadata fails', (t) => {
    const fnInspector = require('@contrast/fn-inspect')
    sinon.stub(fnInspector, 'funcInfo')
    const err = new Error('failed to get function meta')
    fnInspector.funcInfo.throws(err)
    function test() {}
    const meta = getCLMMeta(test)
    t.same(meta, {
      'code.function': 'test'
    })
    t.end()
  })
})
