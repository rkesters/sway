/* eslint-env browser, mocha */

/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Jeremy Whitlock
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

'use strict';

import assert from 'assert';
import fs from 'fs';
import * as helpers from '../src/helpers';
import path from 'path';
import * as Sway from '../src/index';
import YAML from 'js-yaml';
import { OpenAPI } from 'openapi-types';

export const documentBase = path.join(__dirname, 'browser', 'documents');
const relativeBase = typeof window === 'undefined' ? documentBase : 'base/browser/documents';
export const swaggerDoc: OpenAPI.Document = <any>(
    YAML.load(fs.readFileSync(path.join(__dirname, './browser/documents/2.0/swagger.yaml'), 'utf8'))
);
export const swaggerDocCircular: OpenAPI.Document = <any>(
    YAML.load(fs.readFileSync(path.join(__dirname, './browser/documents/2.0/swagger-circular.yaml'), 'utf8'))
);
const swaggerDocRelativeRefs: OpenAPI.Document = <any>(
    YAML.load(fs.readFileSync(path.join(__dirname, './browser/documents/2.0/swagger-relative-refs.yaml'), 'utf8'))
);
export const swaggerDocValidator = helpers.getJSONSchemaValidator();
let swaggerApi;
let swaggerApiCircular;
let swaggerApiRelativeRefs;

export function fail(msg) {
    assert.fail(msg);
}

export function checkType(obj, expectedType) {
    assert.equal(obj.constructor.name, expectedType);
}

export function getSwaggerApi(callback) {
    if (swaggerApi) {
        callback(swaggerApi);
    } else {
        Sway.create({
            definition: swaggerDoc,
        }).then(
            function (obj) {
                swaggerApi = obj;

                callback(swaggerApi);
            },
            function (err) {
                callback(err);
            }
        );
    }
}

export function getSwaggerApiCircular(callback) {
    if (swaggerApiCircular) {
        callback(swaggerApiCircular);
    } else {
        Sway.create({
            definition: swaggerDocCircular,
            jsonRefs: {
                resolveCirculars: true,
            },
        }).then(
            function (obj) {
                swaggerApiCircular = obj;

                callback(swaggerApiCircular);
            },
            function (err) {
                callback(err);
            }
        );
    }
}

export function getSwaggerApiRelativeRefs(callback) {
    if (swaggerApiRelativeRefs) {
        callback(swaggerApiRelativeRefs);
    } else {
        Sway.create({
            definition: swaggerDocRelativeRefs,
            jsonRefs: {
                location: path.join(relativeBase, './2.0/swagger-relative-refs.yaml'),
            },
        }).then(
            function (obj) {
                swaggerApiRelativeRefs = obj;

                callback(swaggerApiRelativeRefs);
            },
            function (err) {
                callback(err);
            }
        );
    }
}

export function getSway() {
    return Sway;
}

export function shouldHadFailed() {
    fail('The code above should had thrown an error');
}

export function shouldNotHadFailed(err) {
    console.error(err.stack);

    fail('The code above should not had thrown an error');
}

export const swaggerDocPath = path.join(relativeBase, './2.0/swagger.yaml');
export const swaggerDocCircularPath = path.join(relativeBase, './2.0/swagger-circular.yaml');
export const swaggerDocRelativeRefsPath = path.join(relativeBase, './2.0/swagger-relative-refs.yaml');
