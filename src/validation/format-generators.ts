/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Apigee Corporation
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

import * as _ from "lodash";
import Base64 from "js-base64";
import jsfdeped, { Schema } from "json-schema-faker";

export const jsf = jsfdeped.format;
export const faker = jsfdeped;
export type Faker = typeof faker
export type Generate = typeof jsfdeped.generate;

/**
 * We have to filter the schema to avoid a maximum callstack issue by deleting the format property.
 *
 * @param {object} schema - The JSON Schema object
 *
 * @returns {object} The filtered schema
 */
function filterSchema(schema: Schema): Schema {
  var cSchema = _.cloneDeep(schema);

  delete cSchema.format;

  return cSchema;
}

// Build the list of custom JSON Schema generator formats
 function byte(mocker: Generate) {
  return function (schema: Schema) {
    const value = mocker(filterSchema(schema));
    return Base64.encode( (value ?? '').toString());
  };
}

 function password(mocker: Generate) {
  return function (schema: Schema) {
    return mocker(filterSchema(schema));
  };
}

export const generators = {
  password,byte
}
