/* UBB Claim Verifier - Browser Bundle */
"use strict";
var UBBVerifier = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target2, all) => {
    for (var name in all)
      __defProp(target2, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target2) => (target2 = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target2, "default", { value: mod, enumerable: true }) : target2,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // node_modules/base64-js/index.js
  var require_base64_js = __commonJS({
    "node_modules/base64-js/index.js"(exports) {
      "use strict";
      init_buffer_shim();
      exports.byteLength = byteLength;
      exports.toByteArray = toByteArray;
      exports.fromByteArray = fromByteArray;
      var lookup = [];
      var revLookup = [];
      var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
      var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      for (i = 0, len = code.length; i < len; ++i) {
        lookup[i] = code[i];
        revLookup[code.charCodeAt(i)] = i;
      }
      var i;
      var len;
      revLookup["-".charCodeAt(0)] = 62;
      revLookup["_".charCodeAt(0)] = 63;
      function getLens(b64) {
        var len2 = b64.length;
        if (len2 % 4 > 0) {
          throw new Error("Invalid string. Length must be a multiple of 4");
        }
        var validLen = b64.indexOf("=");
        if (validLen === -1)
          validLen = len2;
        var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
        return [validLen, placeHoldersLen];
      }
      function byteLength(b64) {
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }
      function _byteLength(b64, validLen, placeHoldersLen) {
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }
      function toByteArray(b64) {
        var tmp;
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
        var curByte = 0;
        var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
        var i2;
        for (i2 = 0; i2 < len2; i2 += 4) {
          tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
          arr[curByte++] = tmp >> 16 & 255;
          arr[curByte++] = tmp >> 8 & 255;
          arr[curByte++] = tmp & 255;
        }
        if (placeHoldersLen === 2) {
          tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
          arr[curByte++] = tmp & 255;
        }
        if (placeHoldersLen === 1) {
          tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
          arr[curByte++] = tmp >> 8 & 255;
          arr[curByte++] = tmp & 255;
        }
        return arr;
      }
      function tripletToBase64(num) {
        return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
      }
      function encodeChunk(uint8, start, end) {
        var tmp;
        var output = [];
        for (var i2 = start; i2 < end; i2 += 3) {
          tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
          output.push(tripletToBase64(tmp));
        }
        return output.join("");
      }
      function fromByteArray(uint8) {
        var tmp;
        var len2 = uint8.length;
        var extraBytes = len2 % 3;
        var parts = [];
        var maxChunkLength = 16383;
        for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) {
          parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
        }
        if (extraBytes === 1) {
          tmp = uint8[len2 - 1];
          parts.push(
            lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
          );
        } else if (extraBytes === 2) {
          tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
          parts.push(
            lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
          );
        }
        return parts.join("");
      }
    }
  });

  // node_modules/ieee754/index.js
  var require_ieee754 = __commonJS({
    "node_modules/ieee754/index.js"(exports) {
      init_buffer_shim();
      exports.read = function(buffer, offset, isLE, mLen, nBytes) {
        var e, m;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var nBits = -7;
        var i = isLE ? nBytes - 1 : 0;
        var d = isLE ? -1 : 1;
        var s = buffer[offset + i];
        i += d;
        e = s & (1 << -nBits) - 1;
        s >>= -nBits;
        nBits += eLen;
        for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
        }
        m = e & (1 << -nBits) - 1;
        e >>= -nBits;
        nBits += mLen;
        for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
        }
        if (e === 0) {
          e = 1 - eBias;
        } else if (e === eMax) {
          return m ? NaN : (s ? -1 : 1) * Infinity;
        } else {
          m = m + Math.pow(2, mLen);
          e = e - eBias;
        }
        return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
      };
      exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
        var e, m, c;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
        var i = isLE ? 0 : nBytes - 1;
        var d = isLE ? 1 : -1;
        var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
        value = Math.abs(value);
        if (isNaN(value) || value === Infinity) {
          m = isNaN(value) ? 1 : 0;
          e = eMax;
        } else {
          e = Math.floor(Math.log(value) / Math.LN2);
          if (value * (c = Math.pow(2, -e)) < 1) {
            e--;
            c *= 2;
          }
          if (e + eBias >= 1) {
            value += rt / c;
          } else {
            value += rt * Math.pow(2, 1 - eBias);
          }
          if (value * c >= 2) {
            e++;
            c /= 2;
          }
          if (e + eBias >= eMax) {
            m = 0;
            e = eMax;
          } else if (e + eBias >= 1) {
            m = (value * c - 1) * Math.pow(2, mLen);
            e = e + eBias;
          } else {
            m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
            e = 0;
          }
        }
        for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
        }
        e = e << mLen | m;
        eLen += mLen;
        for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
        }
        buffer[offset + i - d] |= s * 128;
      };
    }
  });

  // node_modules/buffer/index.js
  var require_buffer = __commonJS({
    "node_modules/buffer/index.js"(exports) {
      "use strict";
      init_buffer_shim();
      var base64 = require_base64_js();
      var ieee754 = require_ieee754();
      var customInspectSymbol = typeof Symbol === "function" && typeof Symbol["for"] === "function" ? Symbol["for"]("nodejs.util.inspect.custom") : null;
      exports.Buffer = Buffer4;
      exports.SlowBuffer = SlowBuffer;
      exports.INSPECT_MAX_BYTES = 50;
      var K_MAX_LENGTH = 2147483647;
      exports.kMaxLength = K_MAX_LENGTH;
      Buffer4.TYPED_ARRAY_SUPPORT = typedArraySupport();
      if (!Buffer4.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
        console.error(
          "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
        );
      }
      function typedArraySupport() {
        try {
          const arr = new Uint8Array(1);
          const proto = { foo: function() {
            return 42;
          } };
          Object.setPrototypeOf(proto, Uint8Array.prototype);
          Object.setPrototypeOf(arr, proto);
          return arr.foo() === 42;
        } catch (e) {
          return false;
        }
      }
      Object.defineProperty(Buffer4.prototype, "parent", {
        enumerable: true,
        get: function() {
          if (!Buffer4.isBuffer(this))
            return void 0;
          return this.buffer;
        }
      });
      Object.defineProperty(Buffer4.prototype, "offset", {
        enumerable: true,
        get: function() {
          if (!Buffer4.isBuffer(this))
            return void 0;
          return this.byteOffset;
        }
      });
      function createBuffer(length) {
        if (length > K_MAX_LENGTH) {
          throw new RangeError('The value "' + length + '" is invalid for option "size"');
        }
        const buf = new Uint8Array(length);
        Object.setPrototypeOf(buf, Buffer4.prototype);
        return buf;
      }
      function Buffer4(arg, encodingOrOffset, length) {
        if (typeof arg === "number") {
          if (typeof encodingOrOffset === "string") {
            throw new TypeError(
              'The "string" argument must be of type string. Received type number'
            );
          }
          return allocUnsafe(arg);
        }
        return from(arg, encodingOrOffset, length);
      }
      Buffer4.poolSize = 8192;
      function from(value, encodingOrOffset, length) {
        if (typeof value === "string") {
          return fromString(value, encodingOrOffset);
        }
        if (ArrayBuffer.isView(value)) {
          return fromArrayView(value);
        }
        if (value == null) {
          throw new TypeError(
            "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
          );
        }
        if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
          return fromArrayBuffer(value, encodingOrOffset, length);
        }
        if (typeof SharedArrayBuffer !== "undefined" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
          return fromArrayBuffer(value, encodingOrOffset, length);
        }
        if (typeof value === "number") {
          throw new TypeError(
            'The "value" argument must not be of type number. Received type number'
          );
        }
        const valueOf = value.valueOf && value.valueOf();
        if (valueOf != null && valueOf !== value) {
          return Buffer4.from(valueOf, encodingOrOffset, length);
        }
        const b = fromObject(value);
        if (b)
          return b;
        if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
          return Buffer4.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
        }
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      }
      Buffer4.from = function(value, encodingOrOffset, length) {
        return from(value, encodingOrOffset, length);
      };
      Object.setPrototypeOf(Buffer4.prototype, Uint8Array.prototype);
      Object.setPrototypeOf(Buffer4, Uint8Array);
      function assertSize(size) {
        if (typeof size !== "number") {
          throw new TypeError('"size" argument must be of type number');
        } else if (size < 0) {
          throw new RangeError('The value "' + size + '" is invalid for option "size"');
        }
      }
      function alloc(size, fill, encoding) {
        assertSize(size);
        if (size <= 0) {
          return createBuffer(size);
        }
        if (fill !== void 0) {
          return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
        }
        return createBuffer(size);
      }
      Buffer4.alloc = function(size, fill, encoding) {
        return alloc(size, fill, encoding);
      };
      function allocUnsafe(size) {
        assertSize(size);
        return createBuffer(size < 0 ? 0 : checked(size) | 0);
      }
      Buffer4.allocUnsafe = function(size) {
        return allocUnsafe(size);
      };
      Buffer4.allocUnsafeSlow = function(size) {
        return allocUnsafe(size);
      };
      function fromString(string, encoding) {
        if (typeof encoding !== "string" || encoding === "") {
          encoding = "utf8";
        }
        if (!Buffer4.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        const length = byteLength(string, encoding) | 0;
        let buf = createBuffer(length);
        const actual = buf.write(string, encoding);
        if (actual !== length) {
          buf = buf.slice(0, actual);
        }
        return buf;
      }
      function fromArrayLike(array) {
        const length = array.length < 0 ? 0 : checked(array.length) | 0;
        const buf = createBuffer(length);
        for (let i = 0; i < length; i += 1) {
          buf[i] = array[i] & 255;
        }
        return buf;
      }
      function fromArrayView(arrayView) {
        if (isInstance(arrayView, Uint8Array)) {
          const copy = new Uint8Array(arrayView);
          return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
        }
        return fromArrayLike(arrayView);
      }
      function fromArrayBuffer(array, byteOffset, length) {
        if (byteOffset < 0 || array.byteLength < byteOffset) {
          throw new RangeError('"offset" is outside of buffer bounds');
        }
        if (array.byteLength < byteOffset + (length || 0)) {
          throw new RangeError('"length" is outside of buffer bounds');
        }
        let buf;
        if (byteOffset === void 0 && length === void 0) {
          buf = new Uint8Array(array);
        } else if (length === void 0) {
          buf = new Uint8Array(array, byteOffset);
        } else {
          buf = new Uint8Array(array, byteOffset, length);
        }
        Object.setPrototypeOf(buf, Buffer4.prototype);
        return buf;
      }
      function fromObject(obj) {
        if (Buffer4.isBuffer(obj)) {
          const len = checked(obj.length) | 0;
          const buf = createBuffer(len);
          if (buf.length === 0) {
            return buf;
          }
          obj.copy(buf, 0, 0, len);
          return buf;
        }
        if (obj.length !== void 0) {
          if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
            return createBuffer(0);
          }
          return fromArrayLike(obj);
        }
        if (obj.type === "Buffer" && Array.isArray(obj.data)) {
          return fromArrayLike(obj.data);
        }
      }
      function checked(length) {
        if (length >= K_MAX_LENGTH) {
          throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
        }
        return length | 0;
      }
      function SlowBuffer(length) {
        if (+length != length) {
          length = 0;
        }
        return Buffer4.alloc(+length);
      }
      Buffer4.isBuffer = function isBuffer(b) {
        return b != null && b._isBuffer === true && b !== Buffer4.prototype;
      };
      Buffer4.compare = function compare(a, b) {
        if (isInstance(a, Uint8Array))
          a = Buffer4.from(a, a.offset, a.byteLength);
        if (isInstance(b, Uint8Array))
          b = Buffer4.from(b, b.offset, b.byteLength);
        if (!Buffer4.isBuffer(a) || !Buffer4.isBuffer(b)) {
          throw new TypeError(
            'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
          );
        }
        if (a === b)
          return 0;
        let x = a.length;
        let y = b.length;
        for (let i = 0, len = Math.min(x, y); i < len; ++i) {
          if (a[i] !== b[i]) {
            x = a[i];
            y = b[i];
            break;
          }
        }
        if (x < y)
          return -1;
        if (y < x)
          return 1;
        return 0;
      };
      Buffer4.isEncoding = function isEncoding(encoding) {
        switch (String(encoding).toLowerCase()) {
          case "hex":
          case "utf8":
          case "utf-8":
          case "ascii":
          case "latin1":
          case "binary":
          case "base64":
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return true;
          default:
            return false;
        }
      };
      Buffer4.concat = function concat(list, length) {
        if (!Array.isArray(list)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        }
        if (list.length === 0) {
          return Buffer4.alloc(0);
        }
        let i;
        if (length === void 0) {
          length = 0;
          for (i = 0; i < list.length; ++i) {
            length += list[i].length;
          }
        }
        const buffer = Buffer4.allocUnsafe(length);
        let pos = 0;
        for (i = 0; i < list.length; ++i) {
          let buf = list[i];
          if (isInstance(buf, Uint8Array)) {
            if (pos + buf.length > buffer.length) {
              if (!Buffer4.isBuffer(buf))
                buf = Buffer4.from(buf);
              buf.copy(buffer, pos);
            } else {
              Uint8Array.prototype.set.call(
                buffer,
                buf,
                pos
              );
            }
          } else if (!Buffer4.isBuffer(buf)) {
            throw new TypeError('"list" argument must be an Array of Buffers');
          } else {
            buf.copy(buffer, pos);
          }
          pos += buf.length;
        }
        return buffer;
      };
      function byteLength(string, encoding) {
        if (Buffer4.isBuffer(string)) {
          return string.length;
        }
        if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
          return string.byteLength;
        }
        if (typeof string !== "string") {
          throw new TypeError(
            'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
          );
        }
        const len = string.length;
        const mustMatch = arguments.length > 2 && arguments[2] === true;
        if (!mustMatch && len === 0)
          return 0;
        let loweredCase = false;
        for (; ; ) {
          switch (encoding) {
            case "ascii":
            case "latin1":
            case "binary":
              return len;
            case "utf8":
            case "utf-8":
              return utf8ToBytes(string).length;
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return len * 2;
            case "hex":
              return len >>> 1;
            case "base64":
              return base64ToBytes(string).length;
            default:
              if (loweredCase) {
                return mustMatch ? -1 : utf8ToBytes(string).length;
              }
              encoding = ("" + encoding).toLowerCase();
              loweredCase = true;
          }
        }
      }
      Buffer4.byteLength = byteLength;
      function slowToString(encoding, start, end) {
        let loweredCase = false;
        if (start === void 0 || start < 0) {
          start = 0;
        }
        if (start > this.length) {
          return "";
        }
        if (end === void 0 || end > this.length) {
          end = this.length;
        }
        if (end <= 0) {
          return "";
        }
        end >>>= 0;
        start >>>= 0;
        if (end <= start) {
          return "";
        }
        if (!encoding)
          encoding = "utf8";
        while (true) {
          switch (encoding) {
            case "hex":
              return hexSlice(this, start, end);
            case "utf8":
            case "utf-8":
              return utf8Slice(this, start, end);
            case "ascii":
              return asciiSlice(this, start, end);
            case "latin1":
            case "binary":
              return latin1Slice(this, start, end);
            case "base64":
              return base64Slice(this, start, end);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return utf16leSlice(this, start, end);
            default:
              if (loweredCase)
                throw new TypeError("Unknown encoding: " + encoding);
              encoding = (encoding + "").toLowerCase();
              loweredCase = true;
          }
        }
      }
      Buffer4.prototype._isBuffer = true;
      function swap(b, n, m) {
        const i = b[n];
        b[n] = b[m];
        b[m] = i;
      }
      Buffer4.prototype.swap16 = function swap16() {
        const len = this.length;
        if (len % 2 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 16-bits");
        }
        for (let i = 0; i < len; i += 2) {
          swap(this, i, i + 1);
        }
        return this;
      };
      Buffer4.prototype.swap32 = function swap32() {
        const len = this.length;
        if (len % 4 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 32-bits");
        }
        for (let i = 0; i < len; i += 4) {
          swap(this, i, i + 3);
          swap(this, i + 1, i + 2);
        }
        return this;
      };
      Buffer4.prototype.swap64 = function swap64() {
        const len = this.length;
        if (len % 8 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 64-bits");
        }
        for (let i = 0; i < len; i += 8) {
          swap(this, i, i + 7);
          swap(this, i + 1, i + 6);
          swap(this, i + 2, i + 5);
          swap(this, i + 3, i + 4);
        }
        return this;
      };
      Buffer4.prototype.toString = function toString() {
        const length = this.length;
        if (length === 0)
          return "";
        if (arguments.length === 0)
          return utf8Slice(this, 0, length);
        return slowToString.apply(this, arguments);
      };
      Buffer4.prototype.toLocaleString = Buffer4.prototype.toString;
      Buffer4.prototype.equals = function equals(b) {
        if (!Buffer4.isBuffer(b))
          throw new TypeError("Argument must be a Buffer");
        if (this === b)
          return true;
        return Buffer4.compare(this, b) === 0;
      };
      Buffer4.prototype.inspect = function inspect() {
        let str = "";
        const max = exports.INSPECT_MAX_BYTES;
        str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
        if (this.length > max)
          str += " ... ";
        return "<Buffer " + str + ">";
      };
      if (customInspectSymbol) {
        Buffer4.prototype[customInspectSymbol] = Buffer4.prototype.inspect;
      }
      Buffer4.prototype.compare = function compare(target2, start, end, thisStart, thisEnd) {
        if (isInstance(target2, Uint8Array)) {
          target2 = Buffer4.from(target2, target2.offset, target2.byteLength);
        }
        if (!Buffer4.isBuffer(target2)) {
          throw new TypeError(
            'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target2
          );
        }
        if (start === void 0) {
          start = 0;
        }
        if (end === void 0) {
          end = target2 ? target2.length : 0;
        }
        if (thisStart === void 0) {
          thisStart = 0;
        }
        if (thisEnd === void 0) {
          thisEnd = this.length;
        }
        if (start < 0 || end > target2.length || thisStart < 0 || thisEnd > this.length) {
          throw new RangeError("out of range index");
        }
        if (thisStart >= thisEnd && start >= end) {
          return 0;
        }
        if (thisStart >= thisEnd) {
          return -1;
        }
        if (start >= end) {
          return 1;
        }
        start >>>= 0;
        end >>>= 0;
        thisStart >>>= 0;
        thisEnd >>>= 0;
        if (this === target2)
          return 0;
        let x = thisEnd - thisStart;
        let y = end - start;
        const len = Math.min(x, y);
        const thisCopy = this.slice(thisStart, thisEnd);
        const targetCopy = target2.slice(start, end);
        for (let i = 0; i < len; ++i) {
          if (thisCopy[i] !== targetCopy[i]) {
            x = thisCopy[i];
            y = targetCopy[i];
            break;
          }
        }
        if (x < y)
          return -1;
        if (y < x)
          return 1;
        return 0;
      };
      function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
        if (buffer.length === 0)
          return -1;
        if (typeof byteOffset === "string") {
          encoding = byteOffset;
          byteOffset = 0;
        } else if (byteOffset > 2147483647) {
          byteOffset = 2147483647;
        } else if (byteOffset < -2147483648) {
          byteOffset = -2147483648;
        }
        byteOffset = +byteOffset;
        if (numberIsNaN(byteOffset)) {
          byteOffset = dir ? 0 : buffer.length - 1;
        }
        if (byteOffset < 0)
          byteOffset = buffer.length + byteOffset;
        if (byteOffset >= buffer.length) {
          if (dir)
            return -1;
          else
            byteOffset = buffer.length - 1;
        } else if (byteOffset < 0) {
          if (dir)
            byteOffset = 0;
          else
            return -1;
        }
        if (typeof val === "string") {
          val = Buffer4.from(val, encoding);
        }
        if (Buffer4.isBuffer(val)) {
          if (val.length === 0) {
            return -1;
          }
          return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
        } else if (typeof val === "number") {
          val = val & 255;
          if (typeof Uint8Array.prototype.indexOf === "function") {
            if (dir) {
              return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
            } else {
              return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
            }
          }
          return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
        }
        throw new TypeError("val must be string, number or Buffer");
      }
      function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
        let indexSize = 1;
        let arrLength = arr.length;
        let valLength = val.length;
        if (encoding !== void 0) {
          encoding = String(encoding).toLowerCase();
          if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
            if (arr.length < 2 || val.length < 2) {
              return -1;
            }
            indexSize = 2;
            arrLength /= 2;
            valLength /= 2;
            byteOffset /= 2;
          }
        }
        function read2(buf, i2) {
          if (indexSize === 1) {
            return buf[i2];
          } else {
            return buf.readUInt16BE(i2 * indexSize);
          }
        }
        let i;
        if (dir) {
          let foundIndex = -1;
          for (i = byteOffset; i < arrLength; i++) {
            if (read2(arr, i) === read2(val, foundIndex === -1 ? 0 : i - foundIndex)) {
              if (foundIndex === -1)
                foundIndex = i;
              if (i - foundIndex + 1 === valLength)
                return foundIndex * indexSize;
            } else {
              if (foundIndex !== -1)
                i -= i - foundIndex;
              foundIndex = -1;
            }
          }
        } else {
          if (byteOffset + valLength > arrLength)
            byteOffset = arrLength - valLength;
          for (i = byteOffset; i >= 0; i--) {
            let found = true;
            for (let j = 0; j < valLength; j++) {
              if (read2(arr, i + j) !== read2(val, j)) {
                found = false;
                break;
              }
            }
            if (found)
              return i;
          }
        }
        return -1;
      }
      Buffer4.prototype.includes = function includes(val, byteOffset, encoding) {
        return this.indexOf(val, byteOffset, encoding) !== -1;
      };
      Buffer4.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
      };
      Buffer4.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
      };
      function hexWrite(buf, string, offset, length) {
        offset = Number(offset) || 0;
        const remaining = buf.length - offset;
        if (!length) {
          length = remaining;
        } else {
          length = Number(length);
          if (length > remaining) {
            length = remaining;
          }
        }
        const strLen = string.length;
        if (length > strLen / 2) {
          length = strLen / 2;
        }
        let i;
        for (i = 0; i < length; ++i) {
          const parsed = parseInt(string.substr(i * 2, 2), 16);
          if (numberIsNaN(parsed))
            return i;
          buf[offset + i] = parsed;
        }
        return i;
      }
      function utf8Write(buf, string, offset, length) {
        return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
      }
      function asciiWrite(buf, string, offset, length) {
        return blitBuffer(asciiToBytes(string), buf, offset, length);
      }
      function base64Write(buf, string, offset, length) {
        return blitBuffer(base64ToBytes(string), buf, offset, length);
      }
      function ucs2Write(buf, string, offset, length) {
        return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
      }
      Buffer4.prototype.write = function write(string, offset, length, encoding) {
        if (offset === void 0) {
          encoding = "utf8";
          length = this.length;
          offset = 0;
        } else if (length === void 0 && typeof offset === "string") {
          encoding = offset;
          length = this.length;
          offset = 0;
        } else if (isFinite(offset)) {
          offset = offset >>> 0;
          if (isFinite(length)) {
            length = length >>> 0;
            if (encoding === void 0)
              encoding = "utf8";
          } else {
            encoding = length;
            length = void 0;
          }
        } else {
          throw new Error(
            "Buffer.write(string, encoding, offset[, length]) is no longer supported"
          );
        }
        const remaining = this.length - offset;
        if (length === void 0 || length > remaining)
          length = remaining;
        if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
          throw new RangeError("Attempt to write outside buffer bounds");
        }
        if (!encoding)
          encoding = "utf8";
        let loweredCase = false;
        for (; ; ) {
          switch (encoding) {
            case "hex":
              return hexWrite(this, string, offset, length);
            case "utf8":
            case "utf-8":
              return utf8Write(this, string, offset, length);
            case "ascii":
            case "latin1":
            case "binary":
              return asciiWrite(this, string, offset, length);
            case "base64":
              return base64Write(this, string, offset, length);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return ucs2Write(this, string, offset, length);
            default:
              if (loweredCase)
                throw new TypeError("Unknown encoding: " + encoding);
              encoding = ("" + encoding).toLowerCase();
              loweredCase = true;
          }
        }
      };
      Buffer4.prototype.toJSON = function toJSON() {
        return {
          type: "Buffer",
          data: Array.prototype.slice.call(this._arr || this, 0)
        };
      };
      function base64Slice(buf, start, end) {
        if (start === 0 && end === buf.length) {
          return base64.fromByteArray(buf);
        } else {
          return base64.fromByteArray(buf.slice(start, end));
        }
      }
      function utf8Slice(buf, start, end) {
        end = Math.min(buf.length, end);
        const res = [];
        let i = start;
        while (i < end) {
          const firstByte = buf[i];
          let codePoint = null;
          let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
          if (i + bytesPerSequence <= end) {
            let secondByte, thirdByte, fourthByte, tempCodePoint;
            switch (bytesPerSequence) {
              case 1:
                if (firstByte < 128) {
                  codePoint = firstByte;
                }
                break;
              case 2:
                secondByte = buf[i + 1];
                if ((secondByte & 192) === 128) {
                  tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                  if (tempCodePoint > 127) {
                    codePoint = tempCodePoint;
                  }
                }
                break;
              case 3:
                secondByte = buf[i + 1];
                thirdByte = buf[i + 2];
                if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                  tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                  if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                    codePoint = tempCodePoint;
                  }
                }
                break;
              case 4:
                secondByte = buf[i + 1];
                thirdByte = buf[i + 2];
                fourthByte = buf[i + 3];
                if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                  tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                  if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                    codePoint = tempCodePoint;
                  }
                }
            }
          }
          if (codePoint === null) {
            codePoint = 65533;
            bytesPerSequence = 1;
          } else if (codePoint > 65535) {
            codePoint -= 65536;
            res.push(codePoint >>> 10 & 1023 | 55296);
            codePoint = 56320 | codePoint & 1023;
          }
          res.push(codePoint);
          i += bytesPerSequence;
        }
        return decodeCodePointsArray(res);
      }
      var MAX_ARGUMENTS_LENGTH = 4096;
      function decodeCodePointsArray(codePoints) {
        const len = codePoints.length;
        if (len <= MAX_ARGUMENTS_LENGTH) {
          return String.fromCharCode.apply(String, codePoints);
        }
        let res = "";
        let i = 0;
        while (i < len) {
          res += String.fromCharCode.apply(
            String,
            codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
          );
        }
        return res;
      }
      function asciiSlice(buf, start, end) {
        let ret = "";
        end = Math.min(buf.length, end);
        for (let i = start; i < end; ++i) {
          ret += String.fromCharCode(buf[i] & 127);
        }
        return ret;
      }
      function latin1Slice(buf, start, end) {
        let ret = "";
        end = Math.min(buf.length, end);
        for (let i = start; i < end; ++i) {
          ret += String.fromCharCode(buf[i]);
        }
        return ret;
      }
      function hexSlice(buf, start, end) {
        const len = buf.length;
        if (!start || start < 0)
          start = 0;
        if (!end || end < 0 || end > len)
          end = len;
        let out = "";
        for (let i = start; i < end; ++i) {
          out += hexSliceLookupTable[buf[i]];
        }
        return out;
      }
      function utf16leSlice(buf, start, end) {
        const bytes = buf.slice(start, end);
        let res = "";
        for (let i = 0; i < bytes.length - 1; i += 2) {
          res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
        }
        return res;
      }
      Buffer4.prototype.slice = function slice(start, end) {
        const len = this.length;
        start = ~~start;
        end = end === void 0 ? len : ~~end;
        if (start < 0) {
          start += len;
          if (start < 0)
            start = 0;
        } else if (start > len) {
          start = len;
        }
        if (end < 0) {
          end += len;
          if (end < 0)
            end = 0;
        } else if (end > len) {
          end = len;
        }
        if (end < start)
          end = start;
        const newBuf = this.subarray(start, end);
        Object.setPrototypeOf(newBuf, Buffer4.prototype);
        return newBuf;
      };
      function checkOffset(offset, ext, length) {
        if (offset % 1 !== 0 || offset < 0)
          throw new RangeError("offset is not uint");
        if (offset + ext > length)
          throw new RangeError("Trying to access beyond buffer length");
      }
      Buffer4.prototype.readUintLE = Buffer4.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert)
          checkOffset(offset, byteLength2, this.length);
        let val = this[offset];
        let mul = 1;
        let i = 0;
        while (++i < byteLength2 && (mul *= 256)) {
          val += this[offset + i] * mul;
        }
        return val;
      };
      Buffer4.prototype.readUintBE = Buffer4.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          checkOffset(offset, byteLength2, this.length);
        }
        let val = this[offset + --byteLength2];
        let mul = 1;
        while (byteLength2 > 0 && (mul *= 256)) {
          val += this[offset + --byteLength2] * mul;
        }
        return val;
      };
      Buffer4.prototype.readUint8 = Buffer4.prototype.readUInt8 = function readUInt8(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 1, this.length);
        return this[offset];
      };
      Buffer4.prototype.readUint16LE = Buffer4.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 2, this.length);
        return this[offset] | this[offset + 1] << 8;
      };
      Buffer4.prototype.readUint16BE = Buffer4.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 2, this.length);
        return this[offset] << 8 | this[offset + 1];
      };
      Buffer4.prototype.readUint32LE = Buffer4.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 4, this.length);
        return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
      };
      Buffer4.prototype.readUint32BE = Buffer4.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 4, this.length);
        return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
      };
      Buffer4.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const lo = first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24;
        const hi = this[++offset] + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + last * 2 ** 24;
        return BigInt(lo) + (BigInt(hi) << BigInt(32));
      });
      Buffer4.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const hi = first * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
        const lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last;
        return (BigInt(hi) << BigInt(32)) + BigInt(lo);
      });
      Buffer4.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert)
          checkOffset(offset, byteLength2, this.length);
        let val = this[offset];
        let mul = 1;
        let i = 0;
        while (++i < byteLength2 && (mul *= 256)) {
          val += this[offset + i] * mul;
        }
        mul *= 128;
        if (val >= mul)
          val -= Math.pow(2, 8 * byteLength2);
        return val;
      };
      Buffer4.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert)
          checkOffset(offset, byteLength2, this.length);
        let i = byteLength2;
        let mul = 1;
        let val = this[offset + --i];
        while (i > 0 && (mul *= 256)) {
          val += this[offset + --i] * mul;
        }
        mul *= 128;
        if (val >= mul)
          val -= Math.pow(2, 8 * byteLength2);
        return val;
      };
      Buffer4.prototype.readInt8 = function readInt8(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 1, this.length);
        if (!(this[offset] & 128))
          return this[offset];
        return (255 - this[offset] + 1) * -1;
      };
      Buffer4.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 2, this.length);
        const val = this[offset] | this[offset + 1] << 8;
        return val & 32768 ? val | 4294901760 : val;
      };
      Buffer4.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 2, this.length);
        const val = this[offset + 1] | this[offset] << 8;
        return val & 32768 ? val | 4294901760 : val;
      };
      Buffer4.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 4, this.length);
        return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
      };
      Buffer4.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 4, this.length);
        return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
      };
      Buffer4.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const val = this[offset + 4] + this[offset + 5] * 2 ** 8 + this[offset + 6] * 2 ** 16 + (last << 24);
        return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24);
      });
      Buffer4.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const val = (first << 24) + // Overflow
        this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
        return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last);
      });
      Buffer4.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 4, this.length);
        return ieee754.read(this, offset, true, 23, 4);
      };
      Buffer4.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 4, this.length);
        return ieee754.read(this, offset, false, 23, 4);
      };
      Buffer4.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 8, this.length);
        return ieee754.read(this, offset, true, 52, 8);
      };
      Buffer4.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert)
          checkOffset(offset, 8, this.length);
        return ieee754.read(this, offset, false, 52, 8);
      };
      function checkInt(buf, value, offset, ext, max, min) {
        if (!Buffer4.isBuffer(buf))
          throw new TypeError('"buffer" argument must be a Buffer instance');
        if (value > max || value < min)
          throw new RangeError('"value" argument is out of bounds');
        if (offset + ext > buf.length)
          throw new RangeError("Index out of range");
      }
      Buffer4.prototype.writeUintLE = Buffer4.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
          checkInt(this, value, offset, byteLength2, maxBytes, 0);
        }
        let mul = 1;
        let i = 0;
        this[offset] = value & 255;
        while (++i < byteLength2 && (mul *= 256)) {
          this[offset + i] = value / mul & 255;
        }
        return offset + byteLength2;
      };
      Buffer4.prototype.writeUintBE = Buffer4.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
          checkInt(this, value, offset, byteLength2, maxBytes, 0);
        }
        let i = byteLength2 - 1;
        let mul = 1;
        this[offset + i] = value & 255;
        while (--i >= 0 && (mul *= 256)) {
          this[offset + i] = value / mul & 255;
        }
        return offset + byteLength2;
      };
      Buffer4.prototype.writeUint8 = Buffer4.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert)
          checkInt(this, value, offset, 1, 255, 0);
        this[offset] = value & 255;
        return offset + 1;
      };
      Buffer4.prototype.writeUint16LE = Buffer4.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert)
          checkInt(this, value, offset, 2, 65535, 0);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        return offset + 2;
      };
      Buffer4.prototype.writeUint16BE = Buffer4.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert)
          checkInt(this, value, offset, 2, 65535, 0);
        this[offset] = value >>> 8;
        this[offset + 1] = value & 255;
        return offset + 2;
      };
      Buffer4.prototype.writeUint32LE = Buffer4.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert)
          checkInt(this, value, offset, 4, 4294967295, 0);
        this[offset + 3] = value >>> 24;
        this[offset + 2] = value >>> 16;
        this[offset + 1] = value >>> 8;
        this[offset] = value & 255;
        return offset + 4;
      };
      Buffer4.prototype.writeUint32BE = Buffer4.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert)
          checkInt(this, value, offset, 4, 4294967295, 0);
        this[offset] = value >>> 24;
        this[offset + 1] = value >>> 16;
        this[offset + 2] = value >>> 8;
        this[offset + 3] = value & 255;
        return offset + 4;
      };
      function wrtBigUInt64LE(buf, value, offset, min, max) {
        checkIntBI(value, min, max, buf, offset, 7);
        let lo = Number(value & BigInt(4294967295));
        buf[offset++] = lo;
        lo = lo >> 8;
        buf[offset++] = lo;
        lo = lo >> 8;
        buf[offset++] = lo;
        lo = lo >> 8;
        buf[offset++] = lo;
        let hi = Number(value >> BigInt(32) & BigInt(4294967295));
        buf[offset++] = hi;
        hi = hi >> 8;
        buf[offset++] = hi;
        hi = hi >> 8;
        buf[offset++] = hi;
        hi = hi >> 8;
        buf[offset++] = hi;
        return offset;
      }
      function wrtBigUInt64BE(buf, value, offset, min, max) {
        checkIntBI(value, min, max, buf, offset, 7);
        let lo = Number(value & BigInt(4294967295));
        buf[offset + 7] = lo;
        lo = lo >> 8;
        buf[offset + 6] = lo;
        lo = lo >> 8;
        buf[offset + 5] = lo;
        lo = lo >> 8;
        buf[offset + 4] = lo;
        let hi = Number(value >> BigInt(32) & BigInt(4294967295));
        buf[offset + 3] = hi;
        hi = hi >> 8;
        buf[offset + 2] = hi;
        hi = hi >> 8;
        buf[offset + 1] = hi;
        hi = hi >> 8;
        buf[offset] = hi;
        return offset + 8;
      }
      Buffer4.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE(value, offset = 0) {
        return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
      });
      Buffer4.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE(value, offset = 0) {
        return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
      });
      Buffer4.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          const limit = Math.pow(2, 8 * byteLength2 - 1);
          checkInt(this, value, offset, byteLength2, limit - 1, -limit);
        }
        let i = 0;
        let mul = 1;
        let sub = 0;
        this[offset] = value & 255;
        while (++i < byteLength2 && (mul *= 256)) {
          if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
            sub = 1;
          }
          this[offset + i] = (value / mul >> 0) - sub & 255;
        }
        return offset + byteLength2;
      };
      Buffer4.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          const limit = Math.pow(2, 8 * byteLength2 - 1);
          checkInt(this, value, offset, byteLength2, limit - 1, -limit);
        }
        let i = byteLength2 - 1;
        let mul = 1;
        let sub = 0;
        this[offset + i] = value & 255;
        while (--i >= 0 && (mul *= 256)) {
          if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
            sub = 1;
          }
          this[offset + i] = (value / mul >> 0) - sub & 255;
        }
        return offset + byteLength2;
      };
      Buffer4.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert)
          checkInt(this, value, offset, 1, 127, -128);
        if (value < 0)
          value = 255 + value + 1;
        this[offset] = value & 255;
        return offset + 1;
      };
      Buffer4.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert)
          checkInt(this, value, offset, 2, 32767, -32768);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        return offset + 2;
      };
      Buffer4.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert)
          checkInt(this, value, offset, 2, 32767, -32768);
        this[offset] = value >>> 8;
        this[offset + 1] = value & 255;
        return offset + 2;
      };
      Buffer4.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert)
          checkInt(this, value, offset, 4, 2147483647, -2147483648);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        this[offset + 2] = value >>> 16;
        this[offset + 3] = value >>> 24;
        return offset + 4;
      };
      Buffer4.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert)
          checkInt(this, value, offset, 4, 2147483647, -2147483648);
        if (value < 0)
          value = 4294967295 + value + 1;
        this[offset] = value >>> 24;
        this[offset + 1] = value >>> 16;
        this[offset + 2] = value >>> 8;
        this[offset + 3] = value & 255;
        return offset + 4;
      };
      Buffer4.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE(value, offset = 0) {
        return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
      });
      Buffer4.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE(value, offset = 0) {
        return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
      });
      function checkIEEE754(buf, value, offset, ext, max, min) {
        if (offset + ext > buf.length)
          throw new RangeError("Index out of range");
        if (offset < 0)
          throw new RangeError("Index out of range");
      }
      function writeFloat(buf, value, offset, littleEndian, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
        }
        ieee754.write(buf, value, offset, littleEndian, 23, 4);
        return offset + 4;
      }
      Buffer4.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
        return writeFloat(this, value, offset, true, noAssert);
      };
      Buffer4.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
        return writeFloat(this, value, offset, false, noAssert);
      };
      function writeDouble(buf, value, offset, littleEndian, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
        }
        ieee754.write(buf, value, offset, littleEndian, 52, 8);
        return offset + 8;
      }
      Buffer4.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
        return writeDouble(this, value, offset, true, noAssert);
      };
      Buffer4.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
        return writeDouble(this, value, offset, false, noAssert);
      };
      Buffer4.prototype.copy = function copy(target2, targetStart, start, end) {
        if (!Buffer4.isBuffer(target2))
          throw new TypeError("argument should be a Buffer");
        if (!start)
          start = 0;
        if (!end && end !== 0)
          end = this.length;
        if (targetStart >= target2.length)
          targetStart = target2.length;
        if (!targetStart)
          targetStart = 0;
        if (end > 0 && end < start)
          end = start;
        if (end === start)
          return 0;
        if (target2.length === 0 || this.length === 0)
          return 0;
        if (targetStart < 0) {
          throw new RangeError("targetStart out of bounds");
        }
        if (start < 0 || start >= this.length)
          throw new RangeError("Index out of range");
        if (end < 0)
          throw new RangeError("sourceEnd out of bounds");
        if (end > this.length)
          end = this.length;
        if (target2.length - targetStart < end - start) {
          end = target2.length - targetStart + start;
        }
        const len = end - start;
        if (this === target2 && typeof Uint8Array.prototype.copyWithin === "function") {
          this.copyWithin(targetStart, start, end);
        } else {
          Uint8Array.prototype.set.call(
            target2,
            this.subarray(start, end),
            targetStart
          );
        }
        return len;
      };
      Buffer4.prototype.fill = function fill(val, start, end, encoding) {
        if (typeof val === "string") {
          if (typeof start === "string") {
            encoding = start;
            start = 0;
            end = this.length;
          } else if (typeof end === "string") {
            encoding = end;
            end = this.length;
          }
          if (encoding !== void 0 && typeof encoding !== "string") {
            throw new TypeError("encoding must be a string");
          }
          if (typeof encoding === "string" && !Buffer4.isEncoding(encoding)) {
            throw new TypeError("Unknown encoding: " + encoding);
          }
          if (val.length === 1) {
            const code = val.charCodeAt(0);
            if (encoding === "utf8" && code < 128 || encoding === "latin1") {
              val = code;
            }
          }
        } else if (typeof val === "number") {
          val = val & 255;
        } else if (typeof val === "boolean") {
          val = Number(val);
        }
        if (start < 0 || this.length < start || this.length < end) {
          throw new RangeError("Out of range index");
        }
        if (end <= start) {
          return this;
        }
        start = start >>> 0;
        end = end === void 0 ? this.length : end >>> 0;
        if (!val)
          val = 0;
        let i;
        if (typeof val === "number") {
          for (i = start; i < end; ++i) {
            this[i] = val;
          }
        } else {
          const bytes = Buffer4.isBuffer(val) ? val : Buffer4.from(val, encoding);
          const len = bytes.length;
          if (len === 0) {
            throw new TypeError('The value "' + val + '" is invalid for argument "value"');
          }
          for (i = 0; i < end - start; ++i) {
            this[i + start] = bytes[i % len];
          }
        }
        return this;
      };
      var errors = {};
      function E(sym, getMessage, Base) {
        errors[sym] = class NodeError extends Base {
          constructor() {
            super();
            Object.defineProperty(this, "message", {
              value: getMessage.apply(this, arguments),
              writable: true,
              configurable: true
            });
            this.name = `${this.name} [${sym}]`;
            this.stack;
            delete this.name;
          }
          get code() {
            return sym;
          }
          set code(value) {
            Object.defineProperty(this, "code", {
              configurable: true,
              enumerable: true,
              value,
              writable: true
            });
          }
          toString() {
            return `${this.name} [${sym}]: ${this.message}`;
          }
        };
      }
      E(
        "ERR_BUFFER_OUT_OF_BOUNDS",
        function(name) {
          if (name) {
            return `${name} is outside of buffer bounds`;
          }
          return "Attempt to access memory outside buffer bounds";
        },
        RangeError
      );
      E(
        "ERR_INVALID_ARG_TYPE",
        function(name, actual) {
          return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
        },
        TypeError
      );
      E(
        "ERR_OUT_OF_RANGE",
        function(str, range, input) {
          let msg = `The value of "${str}" is out of range.`;
          let received = input;
          if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
            received = addNumericalSeparator(String(input));
          } else if (typeof input === "bigint") {
            received = String(input);
            if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
              received = addNumericalSeparator(received);
            }
            received += "n";
          }
          msg += ` It must be ${range}. Received ${received}`;
          return msg;
        },
        RangeError
      );
      function addNumericalSeparator(val) {
        let res = "";
        let i = val.length;
        const start = val[0] === "-" ? 1 : 0;
        for (; i >= start + 4; i -= 3) {
          res = `_${val.slice(i - 3, i)}${res}`;
        }
        return `${val.slice(0, i)}${res}`;
      }
      function checkBounds(buf, offset, byteLength2) {
        validateNumber(offset, "offset");
        if (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) {
          boundsError(offset, buf.length - (byteLength2 + 1));
        }
      }
      function checkIntBI(value, min, max, buf, offset, byteLength2) {
        if (value > max || value < min) {
          const n = typeof min === "bigint" ? "n" : "";
          let range;
          if (byteLength2 > 3) {
            if (min === 0 || min === BigInt(0)) {
              range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
            } else {
              range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
            }
          } else {
            range = `>= ${min}${n} and <= ${max}${n}`;
          }
          throw new errors.ERR_OUT_OF_RANGE("value", range, value);
        }
        checkBounds(buf, offset, byteLength2);
      }
      function validateNumber(value, name) {
        if (typeof value !== "number") {
          throw new errors.ERR_INVALID_ARG_TYPE(name, "number", value);
        }
      }
      function boundsError(value, length, type) {
        if (Math.floor(value) !== value) {
          validateNumber(value, type);
          throw new errors.ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
        }
        if (length < 0) {
          throw new errors.ERR_BUFFER_OUT_OF_BOUNDS();
        }
        throw new errors.ERR_OUT_OF_RANGE(
          type || "offset",
          `>= ${type ? 1 : 0} and <= ${length}`,
          value
        );
      }
      var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
      function base64clean(str) {
        str = str.split("=")[0];
        str = str.trim().replace(INVALID_BASE64_RE, "");
        if (str.length < 2)
          return "";
        while (str.length % 4 !== 0) {
          str = str + "=";
        }
        return str;
      }
      function utf8ToBytes(string, units) {
        units = units || Infinity;
        let codePoint;
        const length = string.length;
        let leadSurrogate = null;
        const bytes = [];
        for (let i = 0; i < length; ++i) {
          codePoint = string.charCodeAt(i);
          if (codePoint > 55295 && codePoint < 57344) {
            if (!leadSurrogate) {
              if (codePoint > 56319) {
                if ((units -= 3) > -1)
                  bytes.push(239, 191, 189);
                continue;
              } else if (i + 1 === length) {
                if ((units -= 3) > -1)
                  bytes.push(239, 191, 189);
                continue;
              }
              leadSurrogate = codePoint;
              continue;
            }
            if (codePoint < 56320) {
              if ((units -= 3) > -1)
                bytes.push(239, 191, 189);
              leadSurrogate = codePoint;
              continue;
            }
            codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
          } else if (leadSurrogate) {
            if ((units -= 3) > -1)
              bytes.push(239, 191, 189);
          }
          leadSurrogate = null;
          if (codePoint < 128) {
            if ((units -= 1) < 0)
              break;
            bytes.push(codePoint);
          } else if (codePoint < 2048) {
            if ((units -= 2) < 0)
              break;
            bytes.push(
              codePoint >> 6 | 192,
              codePoint & 63 | 128
            );
          } else if (codePoint < 65536) {
            if ((units -= 3) < 0)
              break;
            bytes.push(
              codePoint >> 12 | 224,
              codePoint >> 6 & 63 | 128,
              codePoint & 63 | 128
            );
          } else if (codePoint < 1114112) {
            if ((units -= 4) < 0)
              break;
            bytes.push(
              codePoint >> 18 | 240,
              codePoint >> 12 & 63 | 128,
              codePoint >> 6 & 63 | 128,
              codePoint & 63 | 128
            );
          } else {
            throw new Error("Invalid code point");
          }
        }
        return bytes;
      }
      function asciiToBytes(str) {
        const byteArray = [];
        for (let i = 0; i < str.length; ++i) {
          byteArray.push(str.charCodeAt(i) & 255);
        }
        return byteArray;
      }
      function utf16leToBytes(str, units) {
        let c, hi, lo;
        const byteArray = [];
        for (let i = 0; i < str.length; ++i) {
          if ((units -= 2) < 0)
            break;
          c = str.charCodeAt(i);
          hi = c >> 8;
          lo = c % 256;
          byteArray.push(lo);
          byteArray.push(hi);
        }
        return byteArray;
      }
      function base64ToBytes(str) {
        return base64.toByteArray(base64clean(str));
      }
      function blitBuffer(src2, dst, offset, length) {
        let i;
        for (i = 0; i < length; ++i) {
          if (i + offset >= dst.length || i >= src2.length)
            break;
          dst[i + offset] = src2[i];
        }
        return i;
      }
      function isInstance(obj, type) {
        return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
      }
      function numberIsNaN(obj) {
        return obj !== obj;
      }
      var hexSliceLookupTable = function() {
        const alphabet = "0123456789abcdef";
        const table = new Array(256);
        for (let i = 0; i < 16; ++i) {
          const i16 = i * 16;
          for (let j = 0; j < 16; ++j) {
            table[i16 + j] = alphabet[i] + alphabet[j];
          }
        }
        return table;
      }();
      function defineBigIntMethod(fn) {
        return typeof BigInt === "undefined" ? BufferBigIntNotDefined : fn;
      }
      function BufferBigIntNotDefined() {
        throw new Error("BigInt not supported");
      }
    }
  });

  // src/browser/buffer-shim.js
  var import_buffer;
  var init_buffer_shim = __esm({
    "src/browser/buffer-shim.js"() {
      "use strict";
      import_buffer = __toESM(require_buffer());
      window.Buffer = import_buffer.Buffer;
    }
  });

  // node_modules/bmp-js/lib/encoder.js
  var require_encoder = __commonJS({
    "node_modules/bmp-js/lib/encoder.js"(exports, module) {
      init_buffer_shim();
      function BmpEncoder(imgData) {
        this.buffer = imgData.data;
        this.width = imgData.width;
        this.height = imgData.height;
        this.extraBytes = this.width % 4;
        this.rgbSize = this.height * (3 * this.width + this.extraBytes);
        this.headerInfoSize = 40;
        this.data = [];
        this.flag = "BM";
        this.reserved = 0;
        this.offset = 54;
        this.fileSize = this.rgbSize + this.offset;
        this.planes = 1;
        this.bitPP = 24;
        this.compress = 0;
        this.hr = 0;
        this.vr = 0;
        this.colors = 0;
        this.importantColors = 0;
      }
      BmpEncoder.prototype.encode = function() {
        var tempBuffer = new import_buffer.Buffer(this.offset + this.rgbSize);
        this.pos = 0;
        tempBuffer.write(this.flag, this.pos, 2);
        this.pos += 2;
        tempBuffer.writeUInt32LE(this.fileSize, this.pos);
        this.pos += 4;
        tempBuffer.writeUInt32LE(this.reserved, this.pos);
        this.pos += 4;
        tempBuffer.writeUInt32LE(this.offset, this.pos);
        this.pos += 4;
        tempBuffer.writeUInt32LE(this.headerInfoSize, this.pos);
        this.pos += 4;
        tempBuffer.writeUInt32LE(this.width, this.pos);
        this.pos += 4;
        tempBuffer.writeInt32LE(-this.height, this.pos);
        this.pos += 4;
        tempBuffer.writeUInt16LE(this.planes, this.pos);
        this.pos += 2;
        tempBuffer.writeUInt16LE(this.bitPP, this.pos);
        this.pos += 2;
        tempBuffer.writeUInt32LE(this.compress, this.pos);
        this.pos += 4;
        tempBuffer.writeUInt32LE(this.rgbSize, this.pos);
        this.pos += 4;
        tempBuffer.writeUInt32LE(this.hr, this.pos);
        this.pos += 4;
        tempBuffer.writeUInt32LE(this.vr, this.pos);
        this.pos += 4;
        tempBuffer.writeUInt32LE(this.colors, this.pos);
        this.pos += 4;
        tempBuffer.writeUInt32LE(this.importantColors, this.pos);
        this.pos += 4;
        var i = 0;
        var rowBytes = 3 * this.width + this.extraBytes;
        for (var y = 0; y < this.height; y++) {
          for (var x = 0; x < this.width; x++) {
            var p = this.pos + y * rowBytes + x * 3;
            i++;
            tempBuffer[p] = this.buffer[i++];
            tempBuffer[p + 1] = this.buffer[i++];
            tempBuffer[p + 2] = this.buffer[i++];
          }
          if (this.extraBytes > 0) {
            var fillOffset = this.pos + y * rowBytes + this.width * 3;
            tempBuffer.fill(0, fillOffset, fillOffset + this.extraBytes);
          }
        }
        return tempBuffer;
      };
      module.exports = function(imgData, quality) {
        if (typeof quality === "undefined")
          quality = 100;
        var encoder = new BmpEncoder(imgData);
        var data = encoder.encode();
        return {
          data,
          width: imgData.width,
          height: imgData.height
        };
      };
    }
  });

  // node_modules/bmp-js/lib/decoder.js
  var require_decoder = __commonJS({
    "node_modules/bmp-js/lib/decoder.js"(exports, module) {
      init_buffer_shim();
      function BmpDecoder(buffer, is_with_alpha) {
        this.pos = 0;
        this.buffer = buffer;
        this.is_with_alpha = !!is_with_alpha;
        this.bottom_up = true;
        this.flag = this.buffer.toString("utf-8", 0, this.pos += 2);
        if (this.flag != "BM")
          throw new Error("Invalid BMP File");
        this.parseHeader();
        this.parseRGBA();
      }
      BmpDecoder.prototype.parseHeader = function() {
        this.fileSize = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        this.reserved = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        this.offset = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        this.headerSize = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        this.width = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        this.height = this.buffer.readInt32LE(this.pos);
        this.pos += 4;
        this.planes = this.buffer.readUInt16LE(this.pos);
        this.pos += 2;
        this.bitPP = this.buffer.readUInt16LE(this.pos);
        this.pos += 2;
        this.compress = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        this.rawSize = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        this.hr = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        this.vr = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        this.colors = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        this.importantColors = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        if (this.bitPP === 16 && this.is_with_alpha) {
          this.bitPP = 15;
        }
        if (this.bitPP < 15) {
          var len = this.colors === 0 ? 1 << this.bitPP : this.colors;
          this.palette = new Array(len);
          for (var i = 0; i < len; i++) {
            var blue = this.buffer.readUInt8(this.pos++);
            var green = this.buffer.readUInt8(this.pos++);
            var red = this.buffer.readUInt8(this.pos++);
            var quad = this.buffer.readUInt8(this.pos++);
            this.palette[i] = {
              red,
              green,
              blue,
              quad
            };
          }
        }
        if (this.height < 0) {
          this.height *= -1;
          this.bottom_up = false;
        }
      };
      BmpDecoder.prototype.parseRGBA = function() {
        var bitn = "bit" + this.bitPP;
        var len = this.width * this.height * 4;
        this.data = new import_buffer.Buffer(len);
        this[bitn]();
      };
      BmpDecoder.prototype.bit1 = function() {
        var xlen = Math.ceil(this.width / 8);
        var mode = xlen % 4;
        var y = this.height >= 0 ? this.height - 1 : -this.height;
        for (var y = this.height - 1; y >= 0; y--) {
          var line = this.bottom_up ? y : this.height - 1 - y;
          for (var x = 0; x < xlen; x++) {
            var b = this.buffer.readUInt8(this.pos++);
            var location = line * this.width * 4 + x * 8 * 4;
            for (var i = 0; i < 8; i++) {
              if (x * 8 + i < this.width) {
                var rgb = this.palette[b >> 7 - i & 1];
                this.data[location + i * 4] = 0;
                this.data[location + i * 4 + 1] = rgb.blue;
                this.data[location + i * 4 + 2] = rgb.green;
                this.data[location + i * 4 + 3] = rgb.red;
              } else {
                break;
              }
            }
          }
          if (mode != 0) {
            this.pos += 4 - mode;
          }
        }
      };
      BmpDecoder.prototype.bit4 = function() {
        if (this.compress == 2) {
          let setPixelData2 = function(rgbIndex) {
            var rgb2 = this.palette[rgbIndex];
            this.data[location] = 0;
            this.data[location + 1] = rgb2.blue;
            this.data[location + 2] = rgb2.green;
            this.data[location + 3] = rgb2.red;
            location += 4;
          };
          var setPixelData = setPixelData2;
          this.data.fill(255);
          var location = 0;
          var lines = this.bottom_up ? this.height - 1 : 0;
          var low_nibble = false;
          while (location < this.data.length) {
            var a = this.buffer.readUInt8(this.pos++);
            var b = this.buffer.readUInt8(this.pos++);
            if (a == 0) {
              if (b == 0) {
                if (this.bottom_up) {
                  lines--;
                } else {
                  lines++;
                }
                location = lines * this.width * 4;
                low_nibble = false;
                continue;
              } else if (b == 1) {
                break;
              } else if (b == 2) {
                var x = this.buffer.readUInt8(this.pos++);
                var y = this.buffer.readUInt8(this.pos++);
                if (this.bottom_up) {
                  lines -= y;
                } else {
                  lines += y;
                }
                location += y * this.width * 4 + x * 4;
              } else {
                var c = this.buffer.readUInt8(this.pos++);
                for (var i = 0; i < b; i++) {
                  if (low_nibble) {
                    setPixelData2.call(this, c & 15);
                  } else {
                    setPixelData2.call(this, (c & 240) >> 4);
                  }
                  if (i & 1 && i + 1 < b) {
                    c = this.buffer.readUInt8(this.pos++);
                  }
                  low_nibble = !low_nibble;
                }
                if ((b + 1 >> 1 & 1) == 1) {
                  this.pos++;
                }
              }
            } else {
              for (var i = 0; i < a; i++) {
                if (low_nibble) {
                  setPixelData2.call(this, b & 15);
                } else {
                  setPixelData2.call(this, (b & 240) >> 4);
                }
                low_nibble = !low_nibble;
              }
            }
          }
        } else {
          var xlen = Math.ceil(this.width / 2);
          var mode = xlen % 4;
          for (var y = this.height - 1; y >= 0; y--) {
            var line = this.bottom_up ? y : this.height - 1 - y;
            for (var x = 0; x < xlen; x++) {
              var b = this.buffer.readUInt8(this.pos++);
              var location = line * this.width * 4 + x * 2 * 4;
              var before = b >> 4;
              var after = b & 15;
              var rgb = this.palette[before];
              this.data[location] = 0;
              this.data[location + 1] = rgb.blue;
              this.data[location + 2] = rgb.green;
              this.data[location + 3] = rgb.red;
              if (x * 2 + 1 >= this.width)
                break;
              rgb = this.palette[after];
              this.data[location + 4] = 0;
              this.data[location + 4 + 1] = rgb.blue;
              this.data[location + 4 + 2] = rgb.green;
              this.data[location + 4 + 3] = rgb.red;
            }
            if (mode != 0) {
              this.pos += 4 - mode;
            }
          }
        }
      };
      BmpDecoder.prototype.bit8 = function() {
        if (this.compress == 1) {
          let setPixelData2 = function(rgbIndex) {
            var rgb2 = this.palette[rgbIndex];
            this.data[location] = 0;
            this.data[location + 1] = rgb2.blue;
            this.data[location + 2] = rgb2.green;
            this.data[location + 3] = rgb2.red;
            location += 4;
          };
          var setPixelData = setPixelData2;
          this.data.fill(255);
          var location = 0;
          var lines = this.bottom_up ? this.height - 1 : 0;
          while (location < this.data.length) {
            var a = this.buffer.readUInt8(this.pos++);
            var b = this.buffer.readUInt8(this.pos++);
            if (a == 0) {
              if (b == 0) {
                if (this.bottom_up) {
                  lines--;
                } else {
                  lines++;
                }
                location = lines * this.width * 4;
                continue;
              } else if (b == 1) {
                break;
              } else if (b == 2) {
                var x = this.buffer.readUInt8(this.pos++);
                var y = this.buffer.readUInt8(this.pos++);
                if (this.bottom_up) {
                  lines -= y;
                } else {
                  lines += y;
                }
                location += y * this.width * 4 + x * 4;
              } else {
                for (var i = 0; i < b; i++) {
                  var c = this.buffer.readUInt8(this.pos++);
                  setPixelData2.call(this, c);
                }
                if (b & true) {
                  this.pos++;
                }
              }
            } else {
              for (var i = 0; i < a; i++) {
                setPixelData2.call(this, b);
              }
            }
          }
        } else {
          var mode = this.width % 4;
          for (var y = this.height - 1; y >= 0; y--) {
            var line = this.bottom_up ? y : this.height - 1 - y;
            for (var x = 0; x < this.width; x++) {
              var b = this.buffer.readUInt8(this.pos++);
              var location = line * this.width * 4 + x * 4;
              if (b < this.palette.length) {
                var rgb = this.palette[b];
                this.data[location] = 0;
                this.data[location + 1] = rgb.blue;
                this.data[location + 2] = rgb.green;
                this.data[location + 3] = rgb.red;
              } else {
                this.data[location] = 0;
                this.data[location + 1] = 255;
                this.data[location + 2] = 255;
                this.data[location + 3] = 255;
              }
            }
            if (mode != 0) {
              this.pos += 4 - mode;
            }
          }
        }
      };
      BmpDecoder.prototype.bit15 = function() {
        var dif_w = this.width % 3;
        var _11111 = parseInt("11111", 2), _1_5 = _11111;
        for (var y = this.height - 1; y >= 0; y--) {
          var line = this.bottom_up ? y : this.height - 1 - y;
          for (var x = 0; x < this.width; x++) {
            var B = this.buffer.readUInt16LE(this.pos);
            this.pos += 2;
            var blue = (B & _1_5) / _1_5 * 255 | 0;
            var green = (B >> 5 & _1_5) / _1_5 * 255 | 0;
            var red = (B >> 10 & _1_5) / _1_5 * 255 | 0;
            var alpha = B >> 15 ? 255 : 0;
            var location = line * this.width * 4 + x * 4;
            this.data[location] = alpha;
            this.data[location + 1] = blue;
            this.data[location + 2] = green;
            this.data[location + 3] = red;
          }
          this.pos += dif_w;
        }
      };
      BmpDecoder.prototype.bit16 = function() {
        var dif_w = this.width % 2 * 2;
        this.maskRed = 31744;
        this.maskGreen = 992;
        this.maskBlue = 31;
        this.mask0 = 0;
        if (this.compress == 3) {
          this.maskRed = this.buffer.readUInt32LE(this.pos);
          this.pos += 4;
          this.maskGreen = this.buffer.readUInt32LE(this.pos);
          this.pos += 4;
          this.maskBlue = this.buffer.readUInt32LE(this.pos);
          this.pos += 4;
          this.mask0 = this.buffer.readUInt32LE(this.pos);
          this.pos += 4;
        }
        var ns = [0, 0, 0];
        for (var i = 0; i < 16; i++) {
          if (this.maskRed >> i & 1)
            ns[0]++;
          if (this.maskGreen >> i & 1)
            ns[1]++;
          if (this.maskBlue >> i & 1)
            ns[2]++;
        }
        ns[1] += ns[0];
        ns[2] += ns[1];
        ns[0] = 8 - ns[0];
        ns[1] -= 8;
        ns[2] -= 8;
        for (var y = this.height - 1; y >= 0; y--) {
          var line = this.bottom_up ? y : this.height - 1 - y;
          for (var x = 0; x < this.width; x++) {
            var B = this.buffer.readUInt16LE(this.pos);
            this.pos += 2;
            var blue = (B & this.maskBlue) << ns[0];
            var green = (B & this.maskGreen) >> ns[1];
            var red = (B & this.maskRed) >> ns[2];
            var location = line * this.width * 4 + x * 4;
            this.data[location] = 0;
            this.data[location + 1] = blue;
            this.data[location + 2] = green;
            this.data[location + 3] = red;
          }
          this.pos += dif_w;
        }
      };
      BmpDecoder.prototype.bit24 = function() {
        for (var y = this.height - 1; y >= 0; y--) {
          var line = this.bottom_up ? y : this.height - 1 - y;
          for (var x = 0; x < this.width; x++) {
            var blue = this.buffer.readUInt8(this.pos++);
            var green = this.buffer.readUInt8(this.pos++);
            var red = this.buffer.readUInt8(this.pos++);
            var location = line * this.width * 4 + x * 4;
            this.data[location] = 0;
            this.data[location + 1] = blue;
            this.data[location + 2] = green;
            this.data[location + 3] = red;
          }
          this.pos += this.width % 4;
        }
      };
      BmpDecoder.prototype.bit32 = function() {
        if (this.compress == 3) {
          this.maskRed = this.buffer.readUInt32LE(this.pos);
          this.pos += 4;
          this.maskGreen = this.buffer.readUInt32LE(this.pos);
          this.pos += 4;
          this.maskBlue = this.buffer.readUInt32LE(this.pos);
          this.pos += 4;
          this.mask0 = this.buffer.readUInt32LE(this.pos);
          this.pos += 4;
          for (var y = this.height - 1; y >= 0; y--) {
            var line = this.bottom_up ? y : this.height - 1 - y;
            for (var x = 0; x < this.width; x++) {
              var alpha = this.buffer.readUInt8(this.pos++);
              var blue = this.buffer.readUInt8(this.pos++);
              var green = this.buffer.readUInt8(this.pos++);
              var red = this.buffer.readUInt8(this.pos++);
              var location = line * this.width * 4 + x * 4;
              this.data[location] = alpha;
              this.data[location + 1] = blue;
              this.data[location + 2] = green;
              this.data[location + 3] = red;
            }
          }
        } else {
          for (var y = this.height - 1; y >= 0; y--) {
            var line = this.bottom_up ? y : this.height - 1 - y;
            for (var x = 0; x < this.width; x++) {
              var blue = this.buffer.readUInt8(this.pos++);
              var green = this.buffer.readUInt8(this.pos++);
              var red = this.buffer.readUInt8(this.pos++);
              var alpha = this.buffer.readUInt8(this.pos++);
              var location = line * this.width * 4 + x * 4;
              this.data[location] = alpha;
              this.data[location + 1] = blue;
              this.data[location + 2] = green;
              this.data[location + 3] = red;
            }
          }
        }
      };
      BmpDecoder.prototype.getData = function() {
        return this.data;
      };
      module.exports = function(bmpData) {
        var decoder2 = new BmpDecoder(bmpData);
        return decoder2;
      };
    }
  });

  // node_modules/bmp-js/index.js
  var require_bmp_js = __commonJS({
    "node_modules/bmp-js/index.js"(exports, module) {
      init_buffer_shim();
      var encode2 = require_encoder();
      var decode2 = require_decoder();
      module.exports = {
        encode: encode2,
        decode: decode2
      };
    }
  });

  // src/browser/verifier.ts
  var verifier_exports = {};
  __export(verifier_exports, {
    UBBBMP: () => UBBBMP,
    UBBOpReturnData: () => UBBOpReturnData
  });
  init_buffer_shim();

  // src/transactions/ubb-op-return-data.ts
  init_buffer_shim();

  // node_modules/cbor-x/index.js
  init_buffer_shim();

  // node_modules/cbor-x/encode.js
  init_buffer_shim();

  // node_modules/cbor-x/decode.js
  init_buffer_shim();
  var decoder;
  try {
    decoder = new TextDecoder();
  } catch (error) {
  }
  var src;
  var srcEnd;
  var position = 0;
  var EMPTY_ARRAY = [];
  var LEGACY_RECORD_INLINE_ID = 105;
  var RECORD_DEFINITIONS_ID = 57342;
  var RECORD_INLINE_ID = 57343;
  var BUNDLED_STRINGS_ID = 57337;
  var PACKED_REFERENCE_TAG_ID = 6;
  var STOP_CODE = {};
  var maxArraySize = 11281e4;
  var maxMapSize = 1681e4;
  var strings = EMPTY_ARRAY;
  var stringPosition = 0;
  var currentDecoder = {};
  var currentStructures;
  var srcString;
  var srcStringStart = 0;
  var srcStringEnd = 0;
  var bundledStrings;
  var referenceMap;
  var currentExtensions = [];
  var currentExtensionRanges = [];
  var packedValues;
  var dataView;
  var restoreMapsAsObject;
  var defaultOptions = {
    useRecords: false,
    mapsAsObjects: true
  };
  var sequentialMode = false;
  var inlineObjectReadThreshold = 2;
  try {
    new Function("");
  } catch (error) {
    inlineObjectReadThreshold = Infinity;
  }
  var Decoder = class _Decoder {
    constructor(options) {
      if (options) {
        if ((options.keyMap || options._keyMap) && !options.useRecords) {
          options.useRecords = false;
          options.mapsAsObjects = true;
        }
        if (options.useRecords === false && options.mapsAsObjects === void 0)
          options.mapsAsObjects = true;
        if (options.getStructures)
          options.getShared = options.getStructures;
        if (options.getShared && !options.structures)
          (options.structures = []).uninitialized = true;
        if (options.keyMap) {
          this.mapKey = /* @__PURE__ */ new Map();
          for (let [k, v] of Object.entries(options.keyMap))
            this.mapKey.set(v, k);
        }
      }
      Object.assign(this, options);
    }
    /*
    decodeKey(key) {
    	return this.keyMap
    		? Object.keys(this.keyMap)[Object.values(this.keyMap).indexOf(key)] || key
    		: key
    }
    */
    decodeKey(key) {
      return this.keyMap ? this.mapKey.get(key) || key : key;
    }
    encodeKey(key) {
      return this.keyMap && this.keyMap.hasOwnProperty(key) ? this.keyMap[key] : key;
    }
    encodeKeys(rec) {
      if (!this._keyMap)
        return rec;
      let map = /* @__PURE__ */ new Map();
      for (let [k, v] of Object.entries(rec))
        map.set(this._keyMap.hasOwnProperty(k) ? this._keyMap[k] : k, v);
      return map;
    }
    decodeKeys(map) {
      if (!this._keyMap || map.constructor.name != "Map")
        return map;
      if (!this._mapKey) {
        this._mapKey = /* @__PURE__ */ new Map();
        for (let [k, v] of Object.entries(this._keyMap))
          this._mapKey.set(v, k);
      }
      let res = {};
      map.forEach((v, k) => res[safeKey(this._mapKey.has(k) ? this._mapKey.get(k) : k)] = v);
      return res;
    }
    mapDecode(source, end) {
      let res = this.decode(source);
      if (this._keyMap) {
        switch (res.constructor.name) {
          case "Array":
            return res.map((r) => this.decodeKeys(r));
        }
      }
      return res;
    }
    decode(source, end) {
      if (src) {
        return saveState(() => {
          clearSource();
          return this ? this.decode(source, end) : _Decoder.prototype.decode.call(defaultOptions, source, end);
        });
      }
      srcEnd = end > -1 ? end : source.length;
      position = 0;
      stringPosition = 0;
      srcStringEnd = 0;
      srcString = null;
      strings = EMPTY_ARRAY;
      bundledStrings = null;
      src = source;
      try {
        dataView = source.dataView || (source.dataView = new DataView(source.buffer, source.byteOffset, source.byteLength));
      } catch (error) {
        src = null;
        if (source instanceof Uint8Array)
          throw error;
        throw new Error("Source must be a Uint8Array or Buffer but was a " + (source && typeof source == "object" ? source.constructor.name : typeof source));
      }
      if (this instanceof _Decoder) {
        currentDecoder = this;
        packedValues = this.sharedValues && (this.pack ? new Array(this.maxPrivatePackedValues || 16).concat(this.sharedValues) : this.sharedValues);
        if (this.structures) {
          currentStructures = this.structures;
          return checkedRead();
        } else if (!currentStructures || currentStructures.length > 0) {
          currentStructures = [];
        }
      } else {
        currentDecoder = defaultOptions;
        if (!currentStructures || currentStructures.length > 0)
          currentStructures = [];
        packedValues = null;
      }
      return checkedRead();
    }
    decodeMultiple(source, forEach) {
      let values, lastPosition = 0;
      try {
        let size = source.length;
        sequentialMode = true;
        let value = this ? this.decode(source, size) : defaultDecoder.decode(source, size);
        if (forEach) {
          if (forEach(value) === false) {
            return;
          }
          while (position < size) {
            lastPosition = position;
            if (forEach(checkedRead()) === false) {
              return;
            }
          }
        } else {
          values = [value];
          while (position < size) {
            lastPosition = position;
            values.push(checkedRead());
          }
          return values;
        }
      } catch (error) {
        error.lastPosition = lastPosition;
        error.values = values;
        throw error;
      } finally {
        sequentialMode = false;
        clearSource();
      }
    }
  };
  function checkedRead() {
    try {
      let result = read();
      if (bundledStrings) {
        if (position >= bundledStrings.postBundlePosition) {
          let error = new Error("Unexpected bundle position");
          error.incomplete = true;
          throw error;
        }
        position = bundledStrings.postBundlePosition;
        bundledStrings = null;
      }
      if (position == srcEnd) {
        currentStructures = null;
        src = null;
        if (referenceMap)
          referenceMap = null;
      } else if (position > srcEnd) {
        let error = new Error("Unexpected end of CBOR data");
        error.incomplete = true;
        throw error;
      } else if (!sequentialMode) {
        throw new Error("Data read, but end of buffer not reached");
      }
      return result;
    } catch (error) {
      clearSource();
      if (error instanceof RangeError || error.message.startsWith("Unexpected end of buffer")) {
        error.incomplete = true;
      }
      throw error;
    }
  }
  function read() {
    let token = src[position++];
    let majorType = token >> 5;
    token = token & 31;
    if (token > 23) {
      switch (token) {
        case 24:
          token = src[position++];
          break;
        case 25:
          if (majorType == 7) {
            return getFloat16();
          }
          token = dataView.getUint16(position);
          position += 2;
          break;
        case 26:
          if (majorType == 7) {
            let value = dataView.getFloat32(position);
            if (currentDecoder.useFloat32 > 2) {
              let multiplier = mult10[(src[position] & 127) << 1 | src[position + 1] >> 7];
              position += 4;
              return (multiplier * value + (value > 0 ? 0.5 : -0.5) >> 0) / multiplier;
            }
            position += 4;
            return value;
          }
          token = dataView.getUint32(position);
          position += 4;
          break;
        case 27:
          if (majorType == 7) {
            let value = dataView.getFloat64(position);
            position += 8;
            return value;
          }
          if (majorType > 1) {
            if (dataView.getUint32(position) > 0)
              throw new Error("JavaScript does not support arrays, maps, or strings with length over 4294967295");
            token = dataView.getUint32(position + 4);
          } else if (currentDecoder.int64AsNumber) {
            token = dataView.getUint32(position) * 4294967296;
            token += dataView.getUint32(position + 4);
          } else
            token = dataView.getBigUint64(position);
          position += 8;
          break;
        case 31:
          switch (majorType) {
            case 2:
            case 3:
              throw new Error("Indefinite length not supported for byte or text strings");
            case 4:
              let array = [];
              let value, i = 0;
              while ((value = read()) != STOP_CODE) {
                if (i >= maxArraySize)
                  throw new Error(`Array length exceeds ${maxArraySize}`);
                array[i++] = value;
              }
              return majorType == 4 ? array : majorType == 3 ? array.join("") : import_buffer.Buffer.concat(array);
            case 5:
              let key;
              if (currentDecoder.mapsAsObjects) {
                let object = {};
                let i2 = 0;
                if (currentDecoder.keyMap) {
                  while ((key = read()) != STOP_CODE) {
                    if (i2++ >= maxMapSize)
                      throw new Error(`Property count exceeds ${maxMapSize}`);
                    object[safeKey(currentDecoder.decodeKey(key))] = read();
                  }
                } else {
                  while ((key = read()) != STOP_CODE) {
                    if (i2++ >= maxMapSize)
                      throw new Error(`Property count exceeds ${maxMapSize}`);
                    object[safeKey(key)] = read();
                  }
                }
                return object;
              } else {
                if (restoreMapsAsObject) {
                  currentDecoder.mapsAsObjects = true;
                  restoreMapsAsObject = false;
                }
                let map = /* @__PURE__ */ new Map();
                if (currentDecoder.keyMap) {
                  let i2 = 0;
                  while ((key = read()) != STOP_CODE) {
                    if (i2++ >= maxMapSize) {
                      throw new Error(`Map size exceeds ${maxMapSize}`);
                    }
                    map.set(currentDecoder.decodeKey(key), read());
                  }
                } else {
                  let i2 = 0;
                  while ((key = read()) != STOP_CODE) {
                    if (i2++ >= maxMapSize) {
                      throw new Error(`Map size exceeds ${maxMapSize}`);
                    }
                    map.set(key, read());
                  }
                }
                return map;
              }
            case 7:
              return STOP_CODE;
            default:
              throw new Error("Invalid major type for indefinite length " + majorType);
          }
        default:
          throw new Error("Unknown token " + token);
      }
    }
    switch (majorType) {
      case 0:
        return token;
      case 1:
        return ~token;
      case 2:
        return readBin(token);
      case 3:
        if (srcStringEnd >= position) {
          return srcString.slice(position - srcStringStart, (position += token) - srcStringStart);
        }
        if (srcStringEnd == 0 && srcEnd < 140 && token < 32) {
          let string = token < 16 ? shortStringInJS(token) : longStringInJS(token);
          if (string != null)
            return string;
        }
        return readFixedString(token);
      case 4:
        if (token >= maxArraySize)
          throw new Error(`Array length exceeds ${maxArraySize}`);
        let array = new Array(token);
        for (let i = 0; i < token; i++)
          array[i] = read();
        return array;
      case 5:
        if (token >= maxMapSize)
          throw new Error(`Map size exceeds ${maxArraySize}`);
        if (currentDecoder.mapsAsObjects) {
          let object = {};
          if (currentDecoder.keyMap)
            for (let i = 0; i < token; i++)
              object[safeKey(currentDecoder.decodeKey(read()))] = read();
          else
            for (let i = 0; i < token; i++)
              object[safeKey(read())] = read();
          return object;
        } else {
          if (restoreMapsAsObject) {
            currentDecoder.mapsAsObjects = true;
            restoreMapsAsObject = false;
          }
          let map = /* @__PURE__ */ new Map();
          if (currentDecoder.keyMap)
            for (let i = 0; i < token; i++)
              map.set(currentDecoder.decodeKey(read()), read());
          else
            for (let i = 0; i < token; i++)
              map.set(read(), read());
          return map;
        }
      case 6:
        if (token >= BUNDLED_STRINGS_ID) {
          let structure = currentStructures[token & 8191];
          if (structure) {
            if (!structure.read)
              structure.read = createStructureReader(structure);
            return structure.read();
          }
          if (token < 65536) {
            if (token == RECORD_INLINE_ID) {
              let length = readJustLength();
              let id = read();
              let structure2 = read();
              recordDefinition(id, structure2);
              let object = {};
              if (currentDecoder.keyMap)
                for (let i = 2; i < length; i++) {
                  let key = currentDecoder.decodeKey(structure2[i - 2]);
                  object[safeKey(key)] = read();
                }
              else
                for (let i = 2; i < length; i++) {
                  let key = structure2[i - 2];
                  object[safeKey(key)] = read();
                }
              return object;
            } else if (token == RECORD_DEFINITIONS_ID) {
              let length = readJustLength();
              let id = read();
              for (let i = 2; i < length; i++) {
                recordDefinition(id++, read());
              }
              return read();
            } else if (token == BUNDLED_STRINGS_ID) {
              return readBundleExt();
            }
            if (currentDecoder.getShared) {
              loadShared();
              structure = currentStructures[token & 8191];
              if (structure) {
                if (!structure.read)
                  structure.read = createStructureReader(structure);
                return structure.read();
              }
            }
          }
        }
        let extension = currentExtensions[token];
        if (extension) {
          if (extension.handlesRead)
            return extension(read);
          else
            return extension(read());
        } else {
          let input = read();
          for (let i = 0; i < currentExtensionRanges.length; i++) {
            let value = currentExtensionRanges[i](token, input);
            if (value !== void 0)
              return value;
          }
          return new Tag(input, token);
        }
      case 7:
        switch (token) {
          case 20:
            return false;
          case 21:
            return true;
          case 22:
            return null;
          case 23:
            return;
          case 31:
          default:
            let packedValue = (packedValues || getPackedValues())[token];
            if (packedValue !== void 0)
              return packedValue;
            throw new Error("Unknown token " + token);
        }
      default:
        if (isNaN(token)) {
          let error = new Error("Unexpected end of CBOR data");
          error.incomplete = true;
          throw error;
        }
        throw new Error("Unknown CBOR token " + token);
    }
  }
  var validName = /^[a-zA-Z_$][a-zA-Z\d_$]*$/;
  function createStructureReader(structure) {
    if (!structure)
      throw new Error("Structure is required in record definition");
    function readObject() {
      let length = src[position++];
      length = length & 31;
      if (length > 23) {
        switch (length) {
          case 24:
            length = src[position++];
            break;
          case 25:
            length = dataView.getUint16(position);
            position += 2;
            break;
          case 26:
            length = dataView.getUint32(position);
            position += 4;
            break;
          default:
            throw new Error("Expected array header, but got " + src[position - 1]);
        }
      }
      let compiledReader = this.compiledReader;
      while (compiledReader) {
        if (compiledReader.propertyCount === length)
          return compiledReader(read);
        compiledReader = compiledReader.next;
      }
      if (this.slowReads++ >= inlineObjectReadThreshold) {
        let array = this.length == length ? this : this.slice(0, length);
        compiledReader = currentDecoder.keyMap ? new Function("r", "return {" + array.map((k) => currentDecoder.decodeKey(k)).map((k) => validName.test(k) ? safeKey(k) + ":r()" : "[" + JSON.stringify(k) + "]:r()").join(",") + "}") : new Function("r", "return {" + array.map((key) => validName.test(key) ? safeKey(key) + ":r()" : "[" + JSON.stringify(key) + "]:r()").join(",") + "}");
        if (this.compiledReader)
          compiledReader.next = this.compiledReader;
        compiledReader.propertyCount = length;
        this.compiledReader = compiledReader;
        return compiledReader(read);
      }
      let object = {};
      if (currentDecoder.keyMap)
        for (let i = 0; i < length; i++)
          object[safeKey(currentDecoder.decodeKey(this[i]))] = read();
      else
        for (let i = 0; i < length; i++) {
          object[safeKey(this[i])] = read();
        }
      return object;
    }
    structure.slowReads = 0;
    return readObject;
  }
  function safeKey(key) {
    if (typeof key === "string")
      return key === "__proto__" ? "__proto_" : key;
    if (typeof key === "number" || typeof key === "boolean" || typeof key === "bigint")
      return key.toString();
    if (key == null)
      return key + "";
    throw new Error("Invalid property name type " + typeof key);
  }
  var readFixedString = readStringJS;
  function readStringJS(length) {
    let result;
    if (length < 16) {
      if (result = shortStringInJS(length))
        return result;
    }
    if (length > 64 && decoder)
      return decoder.decode(src.subarray(position, position += length));
    const end = position + length;
    const units = [];
    result = "";
    while (position < end) {
      const byte1 = src[position++];
      if ((byte1 & 128) === 0) {
        units.push(byte1);
      } else if ((byte1 & 224) === 192) {
        const byte2 = src[position++] & 63;
        units.push((byte1 & 31) << 6 | byte2);
      } else if ((byte1 & 240) === 224) {
        const byte2 = src[position++] & 63;
        const byte3 = src[position++] & 63;
        units.push((byte1 & 31) << 12 | byte2 << 6 | byte3);
      } else if ((byte1 & 248) === 240) {
        const byte2 = src[position++] & 63;
        const byte3 = src[position++] & 63;
        const byte4 = src[position++] & 63;
        let unit = (byte1 & 7) << 18 | byte2 << 12 | byte3 << 6 | byte4;
        if (unit > 65535) {
          unit -= 65536;
          units.push(unit >>> 10 & 1023 | 55296);
          unit = 56320 | unit & 1023;
        }
        units.push(unit);
      } else {
        units.push(byte1);
      }
      if (units.length >= 4096) {
        result += fromCharCode.apply(String, units);
        units.length = 0;
      }
    }
    if (units.length > 0) {
      result += fromCharCode.apply(String, units);
    }
    return result;
  }
  var fromCharCode = String.fromCharCode;
  function longStringInJS(length) {
    let start = position;
    let bytes = new Array(length);
    for (let i = 0; i < length; i++) {
      const byte = src[position++];
      if ((byte & 128) > 0) {
        position = start;
        return;
      }
      bytes[i] = byte;
    }
    return fromCharCode.apply(String, bytes);
  }
  function shortStringInJS(length) {
    if (length < 4) {
      if (length < 2) {
        if (length === 0)
          return "";
        else {
          let a = src[position++];
          if ((a & 128) > 1) {
            position -= 1;
            return;
          }
          return fromCharCode(a);
        }
      } else {
        let a = src[position++];
        let b = src[position++];
        if ((a & 128) > 0 || (b & 128) > 0) {
          position -= 2;
          return;
        }
        if (length < 3)
          return fromCharCode(a, b);
        let c = src[position++];
        if ((c & 128) > 0) {
          position -= 3;
          return;
        }
        return fromCharCode(a, b, c);
      }
    } else {
      let a = src[position++];
      let b = src[position++];
      let c = src[position++];
      let d = src[position++];
      if ((a & 128) > 0 || (b & 128) > 0 || (c & 128) > 0 || (d & 128) > 0) {
        position -= 4;
        return;
      }
      if (length < 6) {
        if (length === 4)
          return fromCharCode(a, b, c, d);
        else {
          let e = src[position++];
          if ((e & 128) > 0) {
            position -= 5;
            return;
          }
          return fromCharCode(a, b, c, d, e);
        }
      } else if (length < 8) {
        let e = src[position++];
        let f = src[position++];
        if ((e & 128) > 0 || (f & 128) > 0) {
          position -= 6;
          return;
        }
        if (length < 7)
          return fromCharCode(a, b, c, d, e, f);
        let g = src[position++];
        if ((g & 128) > 0) {
          position -= 7;
          return;
        }
        return fromCharCode(a, b, c, d, e, f, g);
      } else {
        let e = src[position++];
        let f = src[position++];
        let g = src[position++];
        let h = src[position++];
        if ((e & 128) > 0 || (f & 128) > 0 || (g & 128) > 0 || (h & 128) > 0) {
          position -= 8;
          return;
        }
        if (length < 10) {
          if (length === 8)
            return fromCharCode(a, b, c, d, e, f, g, h);
          else {
            let i = src[position++];
            if ((i & 128) > 0) {
              position -= 9;
              return;
            }
            return fromCharCode(a, b, c, d, e, f, g, h, i);
          }
        } else if (length < 12) {
          let i = src[position++];
          let j = src[position++];
          if ((i & 128) > 0 || (j & 128) > 0) {
            position -= 10;
            return;
          }
          if (length < 11)
            return fromCharCode(a, b, c, d, e, f, g, h, i, j);
          let k = src[position++];
          if ((k & 128) > 0) {
            position -= 11;
            return;
          }
          return fromCharCode(a, b, c, d, e, f, g, h, i, j, k);
        } else {
          let i = src[position++];
          let j = src[position++];
          let k = src[position++];
          let l = src[position++];
          if ((i & 128) > 0 || (j & 128) > 0 || (k & 128) > 0 || (l & 128) > 0) {
            position -= 12;
            return;
          }
          if (length < 14) {
            if (length === 12)
              return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l);
            else {
              let m = src[position++];
              if ((m & 128) > 0) {
                position -= 13;
                return;
              }
              return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m);
            }
          } else {
            let m = src[position++];
            let n = src[position++];
            if ((m & 128) > 0 || (n & 128) > 0) {
              position -= 14;
              return;
            }
            if (length < 15)
              return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m, n);
            let o = src[position++];
            if ((o & 128) > 0) {
              position -= 15;
              return;
            }
            return fromCharCode(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o);
          }
        }
      }
    }
  }
  function readBin(length) {
    return currentDecoder.copyBuffers ? (
      // specifically use the copying slice (not the node one)
      Uint8Array.prototype.slice.call(src, position, position += length)
    ) : src.subarray(position, position += length);
  }
  var f32Array = new Float32Array(1);
  var u8Array = new Uint8Array(f32Array.buffer, 0, 4);
  function getFloat16() {
    let byte0 = src[position++];
    let byte1 = src[position++];
    let exponent = (byte0 & 127) >> 2;
    if (exponent === 31) {
      if (byte1 || byte0 & 3)
        return NaN;
      return byte0 & 128 ? -Infinity : Infinity;
    }
    if (exponent === 0) {
      let abs = ((byte0 & 3) << 8 | byte1) / (1 << 24);
      return byte0 & 128 ? -abs : abs;
    }
    u8Array[3] = byte0 & 128 | // sign bit
    (exponent >> 1) + 56;
    u8Array[2] = (byte0 & 7) << 5 | // last exponent bit and first two mantissa bits
    byte1 >> 3;
    u8Array[1] = byte1 << 5;
    u8Array[0] = 0;
    return f32Array[0];
  }
  var keyCache = new Array(4096);
  var Tag = class {
    constructor(value, tag) {
      this.value = value;
      this.tag = tag;
    }
  };
  currentExtensions[0] = (dateString) => {
    return new Date(dateString);
  };
  currentExtensions[1] = (epochSec) => {
    return new Date(Math.round(epochSec * 1e3));
  };
  currentExtensions[2] = (buffer) => {
    let value = BigInt(0);
    for (let i = 0, l = buffer.byteLength; i < l; i++) {
      value = BigInt(buffer[i]) + (value << BigInt(8));
    }
    return value;
  };
  currentExtensions[3] = (buffer) => {
    return BigInt(-1) - currentExtensions[2](buffer);
  };
  currentExtensions[4] = (fraction) => {
    return +(fraction[1] + "e" + fraction[0]);
  };
  currentExtensions[5] = (fraction) => {
    return fraction[1] * Math.exp(fraction[0] * Math.log(2));
  };
  var recordDefinition = (id, structure) => {
    id = id - 57344;
    let existingStructure = currentStructures[id];
    if (existingStructure && existingStructure.isShared) {
      (currentStructures.restoreStructures || (currentStructures.restoreStructures = []))[id] = existingStructure;
    }
    currentStructures[id] = structure;
    structure.read = createStructureReader(structure);
  };
  currentExtensions[LEGACY_RECORD_INLINE_ID] = (data) => {
    let length = data.length;
    let structure = data[1];
    recordDefinition(data[0], structure);
    let object = {};
    for (let i = 2; i < length; i++) {
      let key = structure[i - 2];
      object[safeKey(key)] = data[i];
    }
    return object;
  };
  currentExtensions[14] = (value) => {
    if (bundledStrings)
      return bundledStrings[0].slice(bundledStrings.position0, bundledStrings.position0 += value);
    return new Tag(value, 14);
  };
  currentExtensions[15] = (value) => {
    if (bundledStrings)
      return bundledStrings[1].slice(bundledStrings.position1, bundledStrings.position1 += value);
    return new Tag(value, 15);
  };
  var glbl = { Error, RegExp };
  currentExtensions[27] = (data) => {
    return (glbl[data[0]] || Error)(data[1], data[2]);
  };
  var packedTable = (read2) => {
    if (src[position++] != 132) {
      let error = new Error("Packed values structure must be followed by a 4 element array");
      if (src.length < position)
        error.incomplete = true;
      throw error;
    }
    let newPackedValues = read2();
    if (!newPackedValues || !newPackedValues.length) {
      let error = new Error("Packed values structure must be followed by a 4 element array");
      error.incomplete = true;
      throw error;
    }
    packedValues = packedValues ? newPackedValues.concat(packedValues.slice(newPackedValues.length)) : newPackedValues;
    packedValues.prefixes = read2();
    packedValues.suffixes = read2();
    return read2();
  };
  packedTable.handlesRead = true;
  currentExtensions[51] = packedTable;
  currentExtensions[PACKED_REFERENCE_TAG_ID] = (data) => {
    if (!packedValues) {
      if (currentDecoder.getShared)
        loadShared();
      else
        return new Tag(data, PACKED_REFERENCE_TAG_ID);
    }
    if (typeof data == "number")
      return packedValues[16 + (data >= 0 ? 2 * data : -2 * data - 1)];
    let error = new Error("No support for non-integer packed references yet");
    if (data === void 0)
      error.incomplete = true;
    throw error;
  };
  currentExtensions[28] = (read2) => {
    if (!referenceMap) {
      referenceMap = /* @__PURE__ */ new Map();
      referenceMap.id = 0;
    }
    let id = referenceMap.id++;
    let startingPosition = position;
    let token = src[position];
    let target2;
    if (token >> 5 == 4)
      target2 = [];
    else
      target2 = {};
    let refEntry = { target: target2 };
    referenceMap.set(id, refEntry);
    let targetProperties = read2();
    if (refEntry.used) {
      if (Object.getPrototypeOf(target2) !== Object.getPrototypeOf(targetProperties)) {
        position = startingPosition;
        target2 = targetProperties;
        referenceMap.set(id, { target: target2 });
        targetProperties = read2();
      }
      return Object.assign(target2, targetProperties);
    }
    refEntry.target = targetProperties;
    return targetProperties;
  };
  currentExtensions[28].handlesRead = true;
  currentExtensions[29] = (id) => {
    let refEntry = referenceMap.get(id);
    refEntry.used = true;
    return refEntry.target;
  };
  currentExtensions[258] = (array) => new Set(array);
  (currentExtensions[259] = (read2) => {
    if (currentDecoder.mapsAsObjects) {
      currentDecoder.mapsAsObjects = false;
      restoreMapsAsObject = true;
    }
    return read2();
  }).handlesRead = true;
  function combine(a, b) {
    if (typeof a === "string")
      return a + b;
    if (a instanceof Array)
      return a.concat(b);
    return Object.assign({}, a, b);
  }
  function getPackedValues() {
    if (!packedValues) {
      if (currentDecoder.getShared)
        loadShared();
      else
        throw new Error("No packed values available");
    }
    return packedValues;
  }
  var SHARED_DATA_TAG_ID = 1399353956;
  currentExtensionRanges.push((tag, input) => {
    if (tag >= 225 && tag <= 255)
      return combine(getPackedValues().prefixes[tag - 224], input);
    if (tag >= 28704 && tag <= 32767)
      return combine(getPackedValues().prefixes[tag - 28672], input);
    if (tag >= 1879052288 && tag <= 2147483647)
      return combine(getPackedValues().prefixes[tag - 1879048192], input);
    if (tag >= 216 && tag <= 223)
      return combine(input, getPackedValues().suffixes[tag - 216]);
    if (tag >= 27647 && tag <= 28671)
      return combine(input, getPackedValues().suffixes[tag - 27639]);
    if (tag >= 1811940352 && tag <= 1879048191)
      return combine(input, getPackedValues().suffixes[tag - 1811939328]);
    if (tag == SHARED_DATA_TAG_ID) {
      return {
        packedValues,
        structures: currentStructures.slice(0),
        version: input
      };
    }
    if (tag == 55799)
      return input;
  });
  var isLittleEndianMachine = new Uint8Array(new Uint16Array([1]).buffer)[0] == 1;
  var typedArrays = [
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
    typeof BigUint64Array == "undefined" ? { name: "BigUint64Array" } : BigUint64Array,
    Int8Array,
    Int16Array,
    Int32Array,
    typeof BigInt64Array == "undefined" ? { name: "BigInt64Array" } : BigInt64Array,
    Float32Array,
    Float64Array
  ];
  var typedArrayTags = [64, 68, 69, 70, 71, 72, 77, 78, 79, 85, 86];
  for (let i = 0; i < typedArrays.length; i++) {
    registerTypedArray(typedArrays[i], typedArrayTags[i]);
  }
  function registerTypedArray(TypedArray, tag) {
    let dvMethod = "get" + TypedArray.name.slice(0, -5);
    let bytesPerElement;
    if (typeof TypedArray === "function")
      bytesPerElement = TypedArray.BYTES_PER_ELEMENT;
    else
      TypedArray = null;
    for (let littleEndian = 0; littleEndian < 2; littleEndian++) {
      if (!littleEndian && bytesPerElement == 1)
        continue;
      let sizeShift = bytesPerElement == 2 ? 1 : bytesPerElement == 4 ? 2 : bytesPerElement == 8 ? 3 : 0;
      currentExtensions[littleEndian ? tag : tag - 4] = bytesPerElement == 1 || littleEndian == isLittleEndianMachine ? (buffer) => {
        if (!TypedArray)
          throw new Error("Could not find typed array for code " + tag);
        if (!currentDecoder.copyBuffers) {
          if (bytesPerElement === 1 || bytesPerElement === 2 && !(buffer.byteOffset & 1) || bytesPerElement === 4 && !(buffer.byteOffset & 3) || bytesPerElement === 8 && !(buffer.byteOffset & 7))
            return new TypedArray(buffer.buffer, buffer.byteOffset, buffer.byteLength >> sizeShift);
        }
        return new TypedArray(Uint8Array.prototype.slice.call(buffer, 0).buffer);
      } : (buffer) => {
        if (!TypedArray)
          throw new Error("Could not find typed array for code " + tag);
        let dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        let elements = buffer.length >> sizeShift;
        let ta = new TypedArray(elements);
        let method = dv[dvMethod];
        for (let i = 0; i < elements; i++) {
          ta[i] = method.call(dv, i << sizeShift, littleEndian);
        }
        return ta;
      };
    }
  }
  function readBundleExt() {
    let length = readJustLength();
    let bundlePosition = position + read();
    for (let i = 2; i < length; i++) {
      let bundleLength = readJustLength();
      position += bundleLength;
    }
    let dataPosition = position;
    position = bundlePosition;
    bundledStrings = [readStringJS(readJustLength()), readStringJS(readJustLength())];
    bundledStrings.position0 = 0;
    bundledStrings.position1 = 0;
    bundledStrings.postBundlePosition = position;
    position = dataPosition;
    return read();
  }
  function readJustLength() {
    let token = src[position++] & 31;
    if (token > 23) {
      switch (token) {
        case 24:
          token = src[position++];
          break;
        case 25:
          token = dataView.getUint16(position);
          position += 2;
          break;
        case 26:
          token = dataView.getUint32(position);
          position += 4;
          break;
      }
    }
    return token;
  }
  function loadShared() {
    if (currentDecoder.getShared) {
      let sharedData = saveState(() => {
        src = null;
        return currentDecoder.getShared();
      }) || {};
      let updatedStructures = sharedData.structures || [];
      currentDecoder.sharedVersion = sharedData.version;
      packedValues = currentDecoder.sharedValues = sharedData.packedValues;
      if (currentStructures === true)
        currentDecoder.structures = currentStructures = updatedStructures;
      else
        currentStructures.splice.apply(currentStructures, [0, updatedStructures.length].concat(updatedStructures));
    }
  }
  function saveState(callback) {
    let savedSrcEnd = srcEnd;
    let savedPosition = position;
    let savedStringPosition = stringPosition;
    let savedSrcStringStart = srcStringStart;
    let savedSrcStringEnd = srcStringEnd;
    let savedSrcString = srcString;
    let savedStrings = strings;
    let savedReferenceMap = referenceMap;
    let savedBundledStrings = bundledStrings;
    let savedSrc = new Uint8Array(src.slice(0, srcEnd));
    let savedStructures = currentStructures;
    let savedDecoder = currentDecoder;
    let savedSequentialMode = sequentialMode;
    let value = callback();
    srcEnd = savedSrcEnd;
    position = savedPosition;
    stringPosition = savedStringPosition;
    srcStringStart = savedSrcStringStart;
    srcStringEnd = savedSrcStringEnd;
    srcString = savedSrcString;
    strings = savedStrings;
    referenceMap = savedReferenceMap;
    bundledStrings = savedBundledStrings;
    src = savedSrc;
    sequentialMode = savedSequentialMode;
    currentStructures = savedStructures;
    currentDecoder = savedDecoder;
    dataView = new DataView(src.buffer, src.byteOffset, src.byteLength);
    return value;
  }
  function clearSource() {
    src = null;
    referenceMap = null;
    currentStructures = null;
  }
  var mult10 = new Array(147);
  for (let i = 0; i < 256; i++) {
    mult10[i] = +("1e" + Math.floor(45.15 - i * 0.30103));
  }
  var defaultDecoder = new Decoder({ useRecords: false });
  var decode = defaultDecoder.decode;
  var decodeMultiple = defaultDecoder.decodeMultiple;
  var FLOAT32_OPTIONS = {
    NEVER: 0,
    ALWAYS: 1,
    DECIMAL_ROUND: 3,
    DECIMAL_FIT: 4
  };

  // node_modules/cbor-x/encode.js
  var textEncoder;
  try {
    textEncoder = new TextEncoder();
  } catch (error) {
  }
  var extensions;
  var extensionClasses;
  var Buffer3 = typeof globalThis === "object" && globalThis.Buffer;
  var hasNodeBuffer = typeof Buffer3 !== "undefined";
  var ByteArrayAllocate = hasNodeBuffer ? Buffer3.allocUnsafeSlow : Uint8Array;
  var ByteArray = hasNodeBuffer ? Buffer3 : Uint8Array;
  var MAX_STRUCTURES = 256;
  var MAX_BUFFER_SIZE = hasNodeBuffer ? 4294967296 : 2144337920;
  var throwOnIterable;
  var target;
  var targetView;
  var position2 = 0;
  var safeEnd;
  var bundledStrings2 = null;
  var MAX_BUNDLE_SIZE = 61440;
  var hasNonLatin = /[\u0080-\uFFFF]/;
  var RECORD_SYMBOL = Symbol("record-id");
  var Encoder = class extends Decoder {
    constructor(options) {
      super(options);
      this.offset = 0;
      let typeBuffer;
      let start;
      let sharedStructures;
      let hasSharedUpdate;
      let structures;
      let referenceMap2;
      options = options || {};
      let encodeUtf8 = ByteArray.prototype.utf8Write ? function(string, position3, maxBytes) {
        return target.utf8Write(string, position3, maxBytes);
      } : textEncoder && textEncoder.encodeInto ? function(string, position3) {
        return textEncoder.encodeInto(string, target.subarray(position3)).written;
      } : false;
      let encoder = this;
      let hasSharedStructures = options.structures || options.saveStructures;
      let maxSharedStructures = options.maxSharedStructures;
      if (maxSharedStructures == null)
        maxSharedStructures = hasSharedStructures ? 128 : 0;
      if (maxSharedStructures > 8190)
        throw new Error("Maximum maxSharedStructure is 8190");
      let isSequential = options.sequential;
      if (isSequential) {
        maxSharedStructures = 0;
      }
      if (!this.structures)
        this.structures = [];
      if (this.saveStructures)
        this.saveShared = this.saveStructures;
      let samplingPackedValues, packedObjectMap2, sharedValues = options.sharedValues;
      let sharedPackedObjectMap2;
      if (sharedValues) {
        sharedPackedObjectMap2 = /* @__PURE__ */ Object.create(null);
        for (let i = 0, l = sharedValues.length; i < l; i++) {
          sharedPackedObjectMap2[sharedValues[i]] = i;
        }
      }
      let recordIdsToRemove = [];
      let transitionsCount = 0;
      let serializationsSinceTransitionRebuild = 0;
      this.mapEncode = function(value, encodeOptions) {
        if (this._keyMap && !this._mapped) {
          switch (value.constructor.name) {
            case "Array":
              value = value.map((r) => this.encodeKeys(r));
              break;
          }
        }
        return this.encode(value, encodeOptions);
      };
      this.encode = function(value, encodeOptions) {
        if (!target) {
          target = new ByteArrayAllocate(8192);
          targetView = new DataView(target.buffer, 0, 8192);
          position2 = 0;
        }
        safeEnd = target.length - 10;
        if (safeEnd - position2 < 2048) {
          target = new ByteArrayAllocate(target.length);
          targetView = new DataView(target.buffer, 0, target.length);
          safeEnd = target.length - 10;
          position2 = 0;
        } else if (encodeOptions === REUSE_BUFFER_MODE)
          position2 = position2 + 7 & 2147483640;
        start = position2;
        if (encoder.useSelfDescribedHeader) {
          targetView.setUint32(position2, 3654940416);
          position2 += 3;
        }
        referenceMap2 = encoder.structuredClone ? /* @__PURE__ */ new Map() : null;
        if (encoder.bundleStrings && typeof value !== "string") {
          bundledStrings2 = [];
          bundledStrings2.size = Infinity;
        } else
          bundledStrings2 = null;
        sharedStructures = encoder.structures;
        if (sharedStructures) {
          if (sharedStructures.uninitialized) {
            let sharedData = encoder.getShared() || {};
            encoder.structures = sharedStructures = sharedData.structures || [];
            encoder.sharedVersion = sharedData.version;
            let sharedValues2 = encoder.sharedValues = sharedData.packedValues;
            if (sharedValues2) {
              sharedPackedObjectMap2 = {};
              for (let i = 0, l = sharedValues2.length; i < l; i++)
                sharedPackedObjectMap2[sharedValues2[i]] = i;
            }
          }
          let sharedStructuresLength = sharedStructures.length;
          if (sharedStructuresLength > maxSharedStructures && !isSequential)
            sharedStructuresLength = maxSharedStructures;
          if (!sharedStructures.transitions) {
            sharedStructures.transitions = /* @__PURE__ */ Object.create(null);
            for (let i = 0; i < sharedStructuresLength; i++) {
              let keys = sharedStructures[i];
              if (!keys)
                continue;
              let nextTransition, transition = sharedStructures.transitions;
              for (let j = 0, l = keys.length; j < l; j++) {
                if (transition[RECORD_SYMBOL] === void 0)
                  transition[RECORD_SYMBOL] = i;
                let key = keys[j];
                nextTransition = transition[key];
                if (!nextTransition) {
                  nextTransition = transition[key] = /* @__PURE__ */ Object.create(null);
                }
                transition = nextTransition;
              }
              transition[RECORD_SYMBOL] = i | 1048576;
            }
          }
          if (!isSequential)
            sharedStructures.nextId = sharedStructuresLength;
        }
        if (hasSharedUpdate)
          hasSharedUpdate = false;
        structures = sharedStructures || [];
        packedObjectMap2 = sharedPackedObjectMap2;
        if (options.pack) {
          let packedValues2 = /* @__PURE__ */ new Map();
          packedValues2.values = [];
          packedValues2.encoder = encoder;
          packedValues2.maxValues = options.maxPrivatePackedValues || (sharedPackedObjectMap2 ? 16 : Infinity);
          packedValues2.objectMap = sharedPackedObjectMap2 || false;
          packedValues2.samplingPackedValues = samplingPackedValues;
          findRepetitiveStrings(value, packedValues2);
          if (packedValues2.values.length > 0) {
            target[position2++] = 216;
            target[position2++] = 51;
            writeArrayHeader(4);
            let valuesArray = packedValues2.values;
            encode2(valuesArray);
            writeArrayHeader(0);
            writeArrayHeader(0);
            packedObjectMap2 = Object.create(sharedPackedObjectMap2 || null);
            for (let i = 0, l = valuesArray.length; i < l; i++) {
              packedObjectMap2[valuesArray[i]] = i;
            }
          }
        }
        throwOnIterable = encodeOptions & THROW_ON_ITERABLE;
        try {
          if (throwOnIterable)
            return;
          encode2(value);
          if (bundledStrings2) {
            writeBundles(start, encode2);
          }
          encoder.offset = position2;
          if (referenceMap2 && referenceMap2.idsToInsert) {
            position2 += referenceMap2.idsToInsert.length * 2;
            if (position2 > safeEnd)
              makeRoom(position2);
            encoder.offset = position2;
            let serialized = insertIds(target.subarray(start, position2), referenceMap2.idsToInsert);
            referenceMap2 = null;
            return serialized;
          }
          if (encodeOptions & REUSE_BUFFER_MODE) {
            target.start = start;
            target.end = position2;
            return target;
          }
          return target.subarray(start, position2);
        } finally {
          if (sharedStructures) {
            if (serializationsSinceTransitionRebuild < 10)
              serializationsSinceTransitionRebuild++;
            if (sharedStructures.length > maxSharedStructures)
              sharedStructures.length = maxSharedStructures;
            if (transitionsCount > 1e4) {
              sharedStructures.transitions = null;
              serializationsSinceTransitionRebuild = 0;
              transitionsCount = 0;
              if (recordIdsToRemove.length > 0)
                recordIdsToRemove = [];
            } else if (recordIdsToRemove.length > 0 && !isSequential) {
              for (let i = 0, l = recordIdsToRemove.length; i < l; i++) {
                recordIdsToRemove[i][RECORD_SYMBOL] = void 0;
              }
              recordIdsToRemove = [];
            }
          }
          if (hasSharedUpdate && encoder.saveShared) {
            if (encoder.structures.length > maxSharedStructures) {
              encoder.structures = encoder.structures.slice(0, maxSharedStructures);
            }
            let returnBuffer = target.subarray(start, position2);
            if (encoder.updateSharedData() === false)
              return encoder.encode(value);
            return returnBuffer;
          }
          if (encodeOptions & RESET_BUFFER_MODE)
            position2 = start;
        }
      };
      this.findCommonStringsToPack = () => {
        samplingPackedValues = /* @__PURE__ */ new Map();
        if (!sharedPackedObjectMap2)
          sharedPackedObjectMap2 = /* @__PURE__ */ Object.create(null);
        return (options2) => {
          let threshold = options2 && options2.threshold || 4;
          let position3 = this.pack ? options2.maxPrivatePackedValues || 16 : 0;
          if (!sharedValues)
            sharedValues = this.sharedValues = [];
          for (let [key, status] of samplingPackedValues) {
            if (status.count > threshold) {
              sharedPackedObjectMap2[key] = position3++;
              sharedValues.push(key);
              hasSharedUpdate = true;
            }
          }
          while (this.saveShared && this.updateSharedData() === false) {
          }
          samplingPackedValues = null;
        };
      };
      const encode2 = (value) => {
        if (position2 > safeEnd)
          target = makeRoom(position2);
        var type = typeof value;
        var length;
        if (type === "string") {
          if (packedObjectMap2) {
            let packedPosition = packedObjectMap2[value];
            if (packedPosition >= 0) {
              if (packedPosition < 16)
                target[position2++] = packedPosition + 224;
              else {
                target[position2++] = 198;
                if (packedPosition & 1)
                  encode2(15 - packedPosition >> 1);
                else
                  encode2(packedPosition - 16 >> 1);
              }
              return;
            } else if (samplingPackedValues && !options.pack) {
              let status = samplingPackedValues.get(value);
              if (status)
                status.count++;
              else
                samplingPackedValues.set(value, {
                  count: 1
                });
            }
          }
          let strLength = value.length;
          if (bundledStrings2 && strLength >= 4 && strLength < 1024) {
            if ((bundledStrings2.size += strLength) > MAX_BUNDLE_SIZE) {
              let extStart;
              let maxBytes2 = (bundledStrings2[0] ? bundledStrings2[0].length * 3 + bundledStrings2[1].length : 0) + 10;
              if (position2 + maxBytes2 > safeEnd)
                target = makeRoom(position2 + maxBytes2);
              target[position2++] = 217;
              target[position2++] = 223;
              target[position2++] = 249;
              target[position2++] = bundledStrings2.position ? 132 : 130;
              target[position2++] = 26;
              extStart = position2 - start;
              position2 += 4;
              if (bundledStrings2.position) {
                writeBundles(start, encode2);
              }
              bundledStrings2 = ["", ""];
              bundledStrings2.size = 0;
              bundledStrings2.position = extStart;
            }
            let twoByte = hasNonLatin.test(value);
            bundledStrings2[twoByte ? 0 : 1] += value;
            target[position2++] = twoByte ? 206 : 207;
            encode2(strLength);
            return;
          }
          let headerSize;
          if (strLength < 32) {
            headerSize = 1;
          } else if (strLength < 256) {
            headerSize = 2;
          } else if (strLength < 65536) {
            headerSize = 3;
          } else {
            headerSize = 5;
          }
          let maxBytes = strLength * 3;
          if (position2 + maxBytes > safeEnd)
            target = makeRoom(position2 + maxBytes);
          if (strLength < 64 || !encodeUtf8) {
            let i, c1, c2, strPosition = position2 + headerSize;
            for (i = 0; i < strLength; i++) {
              c1 = value.charCodeAt(i);
              if (c1 < 128) {
                target[strPosition++] = c1;
              } else if (c1 < 2048) {
                target[strPosition++] = c1 >> 6 | 192;
                target[strPosition++] = c1 & 63 | 128;
              } else if ((c1 & 64512) === 55296 && ((c2 = value.charCodeAt(i + 1)) & 64512) === 56320) {
                c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
                i++;
                target[strPosition++] = c1 >> 18 | 240;
                target[strPosition++] = c1 >> 12 & 63 | 128;
                target[strPosition++] = c1 >> 6 & 63 | 128;
                target[strPosition++] = c1 & 63 | 128;
              } else {
                target[strPosition++] = c1 >> 12 | 224;
                target[strPosition++] = c1 >> 6 & 63 | 128;
                target[strPosition++] = c1 & 63 | 128;
              }
            }
            length = strPosition - position2 - headerSize;
          } else {
            length = encodeUtf8(value, position2 + headerSize, maxBytes);
          }
          if (length < 24) {
            target[position2++] = 96 | length;
          } else if (length < 256) {
            if (headerSize < 2) {
              target.copyWithin(position2 + 2, position2 + 1, position2 + 1 + length);
            }
            target[position2++] = 120;
            target[position2++] = length;
          } else if (length < 65536) {
            if (headerSize < 3) {
              target.copyWithin(position2 + 3, position2 + 2, position2 + 2 + length);
            }
            target[position2++] = 121;
            target[position2++] = length >> 8;
            target[position2++] = length & 255;
          } else {
            if (headerSize < 5) {
              target.copyWithin(position2 + 5, position2 + 3, position2 + 3 + length);
            }
            target[position2++] = 122;
            targetView.setUint32(position2, length);
            position2 += 4;
          }
          position2 += length;
        } else if (type === "number") {
          if (!this.alwaysUseFloat && value >>> 0 === value) {
            if (value < 24) {
              target[position2++] = value;
            } else if (value < 256) {
              target[position2++] = 24;
              target[position2++] = value;
            } else if (value < 65536) {
              target[position2++] = 25;
              target[position2++] = value >> 8;
              target[position2++] = value & 255;
            } else {
              target[position2++] = 26;
              targetView.setUint32(position2, value);
              position2 += 4;
            }
          } else if (!this.alwaysUseFloat && value >> 0 === value) {
            if (value >= -24) {
              target[position2++] = 31 - value;
            } else if (value >= -256) {
              target[position2++] = 56;
              target[position2++] = ~value;
            } else if (value >= -65536) {
              target[position2++] = 57;
              targetView.setUint16(position2, ~value);
              position2 += 2;
            } else {
              target[position2++] = 58;
              targetView.setUint32(position2, ~value);
              position2 += 4;
            }
          } else {
            let useFloat32;
            if ((useFloat32 = this.useFloat32) > 0 && value < 4294967296 && value >= -2147483648) {
              target[position2++] = 250;
              targetView.setFloat32(position2, value);
              let xShifted;
              if (useFloat32 < 4 || // this checks for rounding of numbers that were encoded in 32-bit float to nearest significant decimal digit that could be preserved
              (xShifted = value * mult10[(target[position2] & 127) << 1 | target[position2 + 1] >> 7]) >> 0 === xShifted) {
                position2 += 4;
                return;
              } else
                position2--;
            }
            target[position2++] = 251;
            targetView.setFloat64(position2, value);
            position2 += 8;
          }
        } else if (type === "object") {
          if (!value)
            target[position2++] = 246;
          else {
            if (referenceMap2) {
              let referee = referenceMap2.get(value);
              if (referee) {
                target[position2++] = 216;
                target[position2++] = 29;
                target[position2++] = 25;
                if (!referee.references) {
                  let idsToInsert = referenceMap2.idsToInsert || (referenceMap2.idsToInsert = []);
                  referee.references = [];
                  idsToInsert.push(referee);
                }
                referee.references.push(position2 - start);
                position2 += 2;
                return;
              } else
                referenceMap2.set(value, { offset: position2 - start });
            }
            let constructor = value.constructor;
            if (constructor === Object) {
              writeObject(value);
            } else if (constructor === Array) {
              length = value.length;
              if (length < 24) {
                target[position2++] = 128 | length;
              } else {
                writeArrayHeader(length);
              }
              for (let i = 0; i < length; i++) {
                encode2(value[i]);
              }
            } else if (constructor === Map) {
              if (this.mapsAsObjects ? this.useTag259ForMaps !== false : this.useTag259ForMaps) {
                target[position2++] = 217;
                target[position2++] = 1;
                target[position2++] = 3;
              }
              length = value.size;
              if (length < 24) {
                target[position2++] = 160 | length;
              } else if (length < 256) {
                target[position2++] = 184;
                target[position2++] = length;
              } else if (length < 65536) {
                target[position2++] = 185;
                target[position2++] = length >> 8;
                target[position2++] = length & 255;
              } else {
                target[position2++] = 186;
                targetView.setUint32(position2, length);
                position2 += 4;
              }
              if (encoder.keyMap) {
                for (let [key, entryValue] of value) {
                  encode2(encoder.encodeKey(key));
                  encode2(entryValue);
                }
              } else {
                for (let [key, entryValue] of value) {
                  encode2(key);
                  encode2(entryValue);
                }
              }
            } else {
              for (let i = 0, l = extensions.length; i < l; i++) {
                let extensionClass = extensionClasses[i];
                if (value instanceof extensionClass) {
                  let extension = extensions[i];
                  let tag = extension.tag;
                  if (tag == void 0)
                    tag = extension.getTag && extension.getTag.call(this, value);
                  if (tag < 24) {
                    target[position2++] = 192 | tag;
                  } else if (tag < 256) {
                    target[position2++] = 216;
                    target[position2++] = tag;
                  } else if (tag < 65536) {
                    target[position2++] = 217;
                    target[position2++] = tag >> 8;
                    target[position2++] = tag & 255;
                  } else if (tag > -1) {
                    target[position2++] = 218;
                    targetView.setUint32(position2, tag);
                    position2 += 4;
                  }
                  extension.encode.call(this, value, encode2, makeRoom);
                  return;
                }
              }
              if (value[Symbol.iterator]) {
                if (throwOnIterable) {
                  let error = new Error("Iterable should be serialized as iterator");
                  error.iteratorNotHandled = true;
                  throw error;
                }
                target[position2++] = 159;
                for (let entry of value) {
                  encode2(entry);
                }
                target[position2++] = 255;
                return;
              }
              if (value[Symbol.asyncIterator] || isBlob(value)) {
                let error = new Error("Iterable/blob should be serialized as iterator");
                error.iteratorNotHandled = true;
                throw error;
              }
              if (this.useToJSON && value.toJSON) {
                const json = value.toJSON();
                if (json !== value)
                  return encode2(json);
              }
              writeObject(value);
            }
          }
        } else if (type === "boolean") {
          target[position2++] = value ? 245 : 244;
        } else if (type === "bigint") {
          if (value < BigInt(1) << BigInt(64) && value >= 0) {
            target[position2++] = 27;
            targetView.setBigUint64(position2, value);
          } else if (value > -(BigInt(1) << BigInt(64)) && value < 0) {
            target[position2++] = 59;
            targetView.setBigUint64(position2, -value - BigInt(1));
          } else {
            if (this.largeBigIntToFloat) {
              target[position2++] = 251;
              targetView.setFloat64(position2, Number(value));
            } else {
              if (value >= BigInt(0))
                target[position2++] = 194;
              else {
                target[position2++] = 195;
                value = BigInt(-1) - value;
              }
              let bytes = [];
              while (value) {
                bytes.push(Number(value & BigInt(255)));
                value >>= BigInt(8);
              }
              writeBuffer(new Uint8Array(bytes.reverse()), makeRoom);
              return;
            }
          }
          position2 += 8;
        } else if (type === "undefined") {
          target[position2++] = 247;
        } else {
          throw new Error("Unknown type: " + type);
        }
      };
      const writeObject = this.useRecords === false ? this.variableMapSize ? (object) => {
        let keys = Object.keys(object);
        let vals = Object.values(object);
        let length = keys.length;
        if (length < 24) {
          target[position2++] = 160 | length;
        } else if (length < 256) {
          target[position2++] = 184;
          target[position2++] = length;
        } else if (length < 65536) {
          target[position2++] = 185;
          target[position2++] = length >> 8;
          target[position2++] = length & 255;
        } else {
          target[position2++] = 186;
          targetView.setUint32(position2, length);
          position2 += 4;
        }
        let key;
        if (encoder.keyMap) {
          for (let i = 0; i < length; i++) {
            encode2(encoder.encodeKey(keys[i]));
            encode2(vals[i]);
          }
        } else {
          for (let i = 0; i < length; i++) {
            encode2(keys[i]);
            encode2(vals[i]);
          }
        }
      } : (object) => {
        target[position2++] = 185;
        let objectOffset = position2 - start;
        position2 += 2;
        let size = 0;
        if (encoder.keyMap) {
          for (let key in object)
            if (typeof object.hasOwnProperty !== "function" || object.hasOwnProperty(key)) {
              encode2(encoder.encodeKey(key));
              encode2(object[key]);
              size++;
            }
        } else {
          for (let key in object)
            if (typeof object.hasOwnProperty !== "function" || object.hasOwnProperty(key)) {
              encode2(key);
              encode2(object[key]);
              size++;
            }
        }
        target[objectOffset++ + start] = size >> 8;
        target[objectOffset + start] = size & 255;
      } : (object, skipValues) => {
        let nextTransition, transition = structures.transitions || (structures.transitions = /* @__PURE__ */ Object.create(null));
        let newTransitions = 0;
        let length = 0;
        let parentRecordId;
        let keys;
        if (this.keyMap) {
          keys = Object.keys(object).map((k) => this.encodeKey(k));
          length = keys.length;
          for (let i = 0; i < length; i++) {
            let key = keys[i];
            nextTransition = transition[key];
            if (!nextTransition) {
              nextTransition = transition[key] = /* @__PURE__ */ Object.create(null);
              newTransitions++;
            }
            transition = nextTransition;
          }
        } else {
          for (let key in object)
            if (typeof object.hasOwnProperty !== "function" || object.hasOwnProperty(key)) {
              nextTransition = transition[key];
              if (!nextTransition) {
                if (transition[RECORD_SYMBOL] & 1048576) {
                  parentRecordId = transition[RECORD_SYMBOL] & 65535;
                }
                nextTransition = transition[key] = /* @__PURE__ */ Object.create(null);
                newTransitions++;
              }
              transition = nextTransition;
              length++;
            }
        }
        let recordId = transition[RECORD_SYMBOL];
        if (recordId !== void 0) {
          recordId &= 65535;
          target[position2++] = 217;
          target[position2++] = recordId >> 8 | 224;
          target[position2++] = recordId & 255;
        } else {
          if (!keys)
            keys = transition.__keys__ || (transition.__keys__ = Object.keys(object));
          if (parentRecordId === void 0) {
            recordId = structures.nextId++;
            if (!recordId) {
              recordId = 0;
              structures.nextId = 1;
            }
            if (recordId >= MAX_STRUCTURES) {
              structures.nextId = (recordId = maxSharedStructures) + 1;
            }
          } else {
            recordId = parentRecordId;
          }
          structures[recordId] = keys;
          if (recordId < maxSharedStructures) {
            target[position2++] = 217;
            target[position2++] = recordId >> 8 | 224;
            target[position2++] = recordId & 255;
            transition = structures.transitions;
            for (let i = 0; i < length; i++) {
              if (transition[RECORD_SYMBOL] === void 0 || transition[RECORD_SYMBOL] & 1048576)
                transition[RECORD_SYMBOL] = recordId;
              transition = transition[keys[i]];
            }
            transition[RECORD_SYMBOL] = recordId | 1048576;
            hasSharedUpdate = true;
          } else {
            transition[RECORD_SYMBOL] = recordId;
            targetView.setUint32(position2, 3655335680);
            position2 += 3;
            if (newTransitions)
              transitionsCount += serializationsSinceTransitionRebuild * newTransitions;
            if (recordIdsToRemove.length >= MAX_STRUCTURES - maxSharedStructures)
              recordIdsToRemove.shift()[RECORD_SYMBOL] = void 0;
            recordIdsToRemove.push(transition);
            writeArrayHeader(length + 2);
            encode2(57344 + recordId);
            encode2(keys);
            if (skipValues)
              return;
            for (let key in object)
              if (typeof object.hasOwnProperty !== "function" || object.hasOwnProperty(key))
                encode2(object[key]);
            return;
          }
        }
        if (length < 24) {
          target[position2++] = 128 | length;
        } else {
          writeArrayHeader(length);
        }
        if (skipValues)
          return;
        for (let key in object)
          if (typeof object.hasOwnProperty !== "function" || object.hasOwnProperty(key))
            encode2(object[key]);
      };
      const makeRoom = (end) => {
        let newSize;
        if (end > 16777216) {
          if (end - start > MAX_BUFFER_SIZE)
            throw new Error("Encoded buffer would be larger than maximum buffer size");
          newSize = Math.min(
            MAX_BUFFER_SIZE,
            Math.round(Math.max((end - start) * (end > 67108864 ? 1.25 : 2), 4194304) / 4096) * 4096
          );
        } else
          newSize = (Math.max(end - start << 2, target.length - 1) >> 12) + 1 << 12;
        let newBuffer = new ByteArrayAllocate(newSize);
        targetView = new DataView(newBuffer.buffer, 0, newSize);
        if (target.copy)
          target.copy(newBuffer, 0, start, end);
        else
          newBuffer.set(target.slice(start, end));
        position2 -= start;
        start = 0;
        safeEnd = newBuffer.length - 10;
        return target = newBuffer;
      };
      let chunkThreshold = 100;
      let continuedChunkThreshold = 1e3;
      this.encodeAsIterable = function(value, options2) {
        return startEncoding(value, options2, encodeObjectAsIterable);
      };
      this.encodeAsAsyncIterable = function(value, options2) {
        return startEncoding(value, options2, encodeObjectAsAsyncIterable);
      };
      function* encodeObjectAsIterable(object, iterateProperties, finalIterable) {
        let constructor = object.constructor;
        if (constructor === Object) {
          let useRecords = encoder.useRecords !== false;
          if (useRecords)
            writeObject(object, true);
          else
            writeEntityLength(Object.keys(object).length, 160);
          for (let key in object) {
            let value = object[key];
            if (!useRecords)
              encode2(key);
            if (value && typeof value === "object") {
              if (iterateProperties[key])
                yield* encodeObjectAsIterable(value, iterateProperties[key]);
              else
                yield* tryEncode(value, iterateProperties, key);
            } else
              encode2(value);
          }
        } else if (constructor === Array) {
          let length = object.length;
          writeArrayHeader(length);
          for (let i = 0; i < length; i++) {
            let value = object[i];
            if (value && (typeof value === "object" || position2 - start > chunkThreshold)) {
              if (iterateProperties.element)
                yield* encodeObjectAsIterable(value, iterateProperties.element);
              else
                yield* tryEncode(value, iterateProperties, "element");
            } else
              encode2(value);
          }
        } else if (object[Symbol.iterator] && !object.buffer) {
          target[position2++] = 159;
          for (let value of object) {
            if (value && (typeof value === "object" || position2 - start > chunkThreshold)) {
              if (iterateProperties.element)
                yield* encodeObjectAsIterable(value, iterateProperties.element);
              else
                yield* tryEncode(value, iterateProperties, "element");
            } else
              encode2(value);
          }
          target[position2++] = 255;
        } else if (isBlob(object)) {
          writeEntityLength(object.size, 64);
          yield target.subarray(start, position2);
          yield object;
          restartEncoding();
        } else if (object[Symbol.asyncIterator]) {
          target[position2++] = 159;
          yield target.subarray(start, position2);
          yield object;
          restartEncoding();
          target[position2++] = 255;
        } else {
          encode2(object);
        }
        if (finalIterable && position2 > start)
          yield target.subarray(start, position2);
        else if (position2 - start > chunkThreshold) {
          yield target.subarray(start, position2);
          restartEncoding();
        }
      }
      function* tryEncode(value, iterateProperties, key) {
        let restart = position2 - start;
        try {
          encode2(value);
          if (position2 - start > chunkThreshold) {
            yield target.subarray(start, position2);
            restartEncoding();
          }
        } catch (error) {
          if (error.iteratorNotHandled) {
            iterateProperties[key] = {};
            position2 = start + restart;
            yield* encodeObjectAsIterable.call(this, value, iterateProperties[key]);
          } else
            throw error;
        }
      }
      function restartEncoding() {
        chunkThreshold = continuedChunkThreshold;
        encoder.encode(null, THROW_ON_ITERABLE);
      }
      function startEncoding(value, options2, encodeIterable) {
        if (options2 && options2.chunkThreshold)
          chunkThreshold = continuedChunkThreshold = options2.chunkThreshold;
        else
          chunkThreshold = 100;
        if (value && typeof value === "object") {
          encoder.encode(null, THROW_ON_ITERABLE);
          return encodeIterable(value, encoder.iterateProperties || (encoder.iterateProperties = {}), true);
        }
        return [encoder.encode(value)];
      }
      async function* encodeObjectAsAsyncIterable(value, iterateProperties) {
        for (let encodedValue of encodeObjectAsIterable(value, iterateProperties, true)) {
          let constructor = encodedValue.constructor;
          if (constructor === ByteArray || constructor === Uint8Array)
            yield encodedValue;
          else if (isBlob(encodedValue)) {
            let reader = encodedValue.stream().getReader();
            let next;
            while (!(next = await reader.read()).done) {
              yield next.value;
            }
          } else if (encodedValue[Symbol.asyncIterator]) {
            for await (let asyncValue of encodedValue) {
              restartEncoding();
              if (asyncValue)
                yield* encodeObjectAsAsyncIterable(asyncValue, iterateProperties.async || (iterateProperties.async = {}));
              else
                yield encoder.encode(asyncValue);
            }
          } else {
            yield encodedValue;
          }
        }
      }
    }
    useBuffer(buffer) {
      target = buffer;
      targetView = new DataView(target.buffer, target.byteOffset, target.byteLength);
      position2 = 0;
    }
    clearSharedData() {
      if (this.structures)
        this.structures = [];
      if (this.sharedValues)
        this.sharedValues = void 0;
    }
    updateSharedData() {
      let lastVersion = this.sharedVersion || 0;
      this.sharedVersion = lastVersion + 1;
      let structuresCopy = this.structures.slice(0);
      let sharedData = new SharedData(structuresCopy, this.sharedValues, this.sharedVersion);
      let saveResults = this.saveShared(
        sharedData,
        (existingShared) => (existingShared && existingShared.version || 0) == lastVersion
      );
      if (saveResults === false) {
        sharedData = this.getShared() || {};
        this.structures = sharedData.structures || [];
        this.sharedValues = sharedData.packedValues;
        this.sharedVersion = sharedData.version;
        this.structures.nextId = this.structures.length;
      } else {
        structuresCopy.forEach((structure, i) => this.structures[i] = structure);
      }
      return saveResults;
    }
  };
  function writeEntityLength(length, majorValue) {
    if (length < 24)
      target[position2++] = majorValue | length;
    else if (length < 256) {
      target[position2++] = majorValue | 24;
      target[position2++] = length;
    } else if (length < 65536) {
      target[position2++] = majorValue | 25;
      target[position2++] = length >> 8;
      target[position2++] = length & 255;
    } else {
      target[position2++] = majorValue | 26;
      targetView.setUint32(position2, length);
      position2 += 4;
    }
  }
  var SharedData = class {
    constructor(structures, values, version) {
      this.structures = structures;
      this.packedValues = values;
      this.version = version;
    }
  };
  function writeArrayHeader(length) {
    if (length < 24)
      target[position2++] = 128 | length;
    else if (length < 256) {
      target[position2++] = 152;
      target[position2++] = length;
    } else if (length < 65536) {
      target[position2++] = 153;
      target[position2++] = length >> 8;
      target[position2++] = length & 255;
    } else {
      target[position2++] = 154;
      targetView.setUint32(position2, length);
      position2 += 4;
    }
  }
  var BlobConstructor = typeof Blob === "undefined" ? function() {
  } : Blob;
  function isBlob(object) {
    if (object instanceof BlobConstructor)
      return true;
    let tag = object[Symbol.toStringTag];
    return tag === "Blob" || tag === "File";
  }
  function findRepetitiveStrings(value, packedValues2) {
    switch (typeof value) {
      case "string":
        if (value.length > 3) {
          if (packedValues2.objectMap[value] > -1 || packedValues2.values.length >= packedValues2.maxValues)
            return;
          let packedStatus = packedValues2.get(value);
          if (packedStatus) {
            if (++packedStatus.count == 2) {
              packedValues2.values.push(value);
            }
          } else {
            packedValues2.set(value, {
              count: 1
            });
            if (packedValues2.samplingPackedValues) {
              let status = packedValues2.samplingPackedValues.get(value);
              if (status)
                status.count++;
              else
                packedValues2.samplingPackedValues.set(value, {
                  count: 1
                });
            }
          }
        }
        break;
      case "object":
        if (value) {
          if (value instanceof Array) {
            for (let i = 0, l = value.length; i < l; i++) {
              findRepetitiveStrings(value[i], packedValues2);
            }
          } else {
            let includeKeys = !packedValues2.encoder.useRecords;
            for (var key in value) {
              if (value.hasOwnProperty(key)) {
                if (includeKeys)
                  findRepetitiveStrings(key, packedValues2);
                findRepetitiveStrings(value[key], packedValues2);
              }
            }
          }
        }
        break;
      case "function":
        console.log(value);
    }
  }
  var isLittleEndianMachine2 = new Uint8Array(new Uint16Array([1]).buffer)[0] == 1;
  extensionClasses = [
    Date,
    Set,
    Error,
    RegExp,
    Tag,
    ArrayBuffer,
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
    typeof BigUint64Array == "undefined" ? function() {
    } : BigUint64Array,
    Int8Array,
    Int16Array,
    Int32Array,
    typeof BigInt64Array == "undefined" ? function() {
    } : BigInt64Array,
    Float32Array,
    Float64Array,
    SharedData
  ];
  extensions = [
    {
      // Date
      tag: 1,
      encode(date, encode2) {
        let seconds = date.getTime() / 1e3;
        if ((this.useTimestamp32 || date.getMilliseconds() === 0) && seconds >= 0 && seconds < 4294967296) {
          target[position2++] = 26;
          targetView.setUint32(position2, seconds);
          position2 += 4;
        } else {
          target[position2++] = 251;
          targetView.setFloat64(position2, seconds);
          position2 += 8;
        }
      }
    },
    {
      // Set
      tag: 258,
      // https://github.com/input-output-hk/cbor-sets-spec/blob/master/CBOR_SETS.md
      encode(set, encode2) {
        let array = Array.from(set);
        encode2(array);
      }
    },
    {
      // Error
      tag: 27,
      // http://cbor.schmorp.de/generic-object
      encode(error, encode2) {
        encode2([error.name, error.message]);
      }
    },
    {
      // RegExp
      tag: 27,
      // http://cbor.schmorp.de/generic-object
      encode(regex, encode2) {
        encode2(["RegExp", regex.source, regex.flags]);
      }
    },
    {
      // Tag
      getTag(tag) {
        return tag.tag;
      },
      encode(tag, encode2) {
        encode2(tag.value);
      }
    },
    {
      // ArrayBuffer
      encode(arrayBuffer, encode2, makeRoom) {
        writeBuffer(arrayBuffer, makeRoom);
      }
    },
    {
      // Uint8Array
      getTag(typedArray) {
        if (typedArray.constructor === Uint8Array) {
          if (this.tagUint8Array || hasNodeBuffer && this.tagUint8Array !== false)
            return 64;
        }
      },
      encode(typedArray, encode2, makeRoom) {
        writeBuffer(typedArray, makeRoom);
      }
    },
    typedArrayEncoder(68, 1),
    typedArrayEncoder(69, 2),
    typedArrayEncoder(70, 4),
    typedArrayEncoder(71, 8),
    typedArrayEncoder(72, 1),
    typedArrayEncoder(77, 2),
    typedArrayEncoder(78, 4),
    typedArrayEncoder(79, 8),
    typedArrayEncoder(85, 4),
    typedArrayEncoder(86, 8),
    {
      encode(sharedData, encode2) {
        let packedValues2 = sharedData.packedValues || [];
        let sharedStructures = sharedData.structures || [];
        if (packedValues2.values.length > 0) {
          target[position2++] = 216;
          target[position2++] = 51;
          writeArrayHeader(4);
          let valuesArray = packedValues2.values;
          encode2(valuesArray);
          writeArrayHeader(0);
          writeArrayHeader(0);
          packedObjectMap = Object.create(sharedPackedObjectMap || null);
          for (let i = 0, l = valuesArray.length; i < l; i++) {
            packedObjectMap[valuesArray[i]] = i;
          }
        }
        if (sharedStructures) {
          targetView.setUint32(position2, 3655335424);
          position2 += 3;
          let definitions = sharedStructures.slice(0);
          definitions.unshift(57344);
          definitions.push(new Tag(sharedData.version, 1399353956));
          encode2(definitions);
        } else
          encode2(new Tag(sharedData.version, 1399353956));
      }
    }
  ];
  function typedArrayEncoder(tag, size) {
    if (!isLittleEndianMachine2 && size > 1)
      tag -= 4;
    return {
      tag,
      encode: function writeExtBuffer(typedArray, encode2) {
        let length = typedArray.byteLength;
        let offset = typedArray.byteOffset || 0;
        let buffer = typedArray.buffer || typedArray;
        encode2(hasNodeBuffer ? Buffer3.from(buffer, offset, length) : new Uint8Array(buffer, offset, length));
      }
    };
  }
  function writeBuffer(buffer, makeRoom) {
    let length = buffer.byteLength;
    if (length < 24) {
      target[position2++] = 64 + length;
    } else if (length < 256) {
      target[position2++] = 88;
      target[position2++] = length;
    } else if (length < 65536) {
      target[position2++] = 89;
      target[position2++] = length >> 8;
      target[position2++] = length & 255;
    } else {
      target[position2++] = 90;
      targetView.setUint32(position2, length);
      position2 += 4;
    }
    if (position2 + length >= target.length) {
      makeRoom(position2 + length);
    }
    target.set(buffer.buffer ? buffer : new Uint8Array(buffer), position2);
    position2 += length;
  }
  function insertIds(serialized, idsToInsert) {
    let nextId;
    let distanceToMove = idsToInsert.length * 2;
    let lastEnd = serialized.length - distanceToMove;
    idsToInsert.sort((a, b) => a.offset > b.offset ? 1 : -1);
    for (let id = 0; id < idsToInsert.length; id++) {
      let referee = idsToInsert[id];
      referee.id = id;
      for (let position3 of referee.references) {
        serialized[position3++] = id >> 8;
        serialized[position3] = id & 255;
      }
    }
    while (nextId = idsToInsert.pop()) {
      let offset = nextId.offset;
      serialized.copyWithin(offset + distanceToMove, offset, lastEnd);
      distanceToMove -= 2;
      let position3 = offset + distanceToMove;
      serialized[position3++] = 216;
      serialized[position3++] = 28;
      lastEnd = offset;
    }
    return serialized;
  }
  function writeBundles(start, encode2) {
    targetView.setUint32(bundledStrings2.position + start, position2 - bundledStrings2.position - start + 1);
    let writeStrings = bundledStrings2;
    bundledStrings2 = null;
    encode2(writeStrings[0]);
    encode2(writeStrings[1]);
  }
  var defaultEncoder = new Encoder({ useRecords: false });
  var encode = defaultEncoder.encode;
  var encodeAsIterable = defaultEncoder.encodeAsIterable;
  var encodeAsAsyncIterable = defaultEncoder.encodeAsAsyncIterable;
  var { NEVER, ALWAYS, DECIMAL_ROUND, DECIMAL_FIT } = FLOAT32_OPTIONS;
  var REUSE_BUFFER_MODE = 512;
  var RESET_BUFFER_MODE = 1024;
  var THROW_ON_ITERABLE = 2048;

  // node_modules/cbor-x/iterators.js
  init_buffer_shim();

  // src/transactions/ubb-op-return-data.ts
  function isValidUTF8(buffer) {
    let i = 0;
    while (i < buffer.length) {
      const byte = buffer[i];
      if (byte <= 127) {
        i += 1;
        continue;
      }
      if ((byte & 224) === 192) {
        if (i + 1 >= buffer.length)
          return false;
        if ((buffer[i + 1] & 192) !== 128)
          return false;
        if (byte < 194)
          return false;
        i += 2;
        continue;
      }
      if ((byte & 240) === 224) {
        if (i + 2 >= buffer.length)
          return false;
        if ((buffer[i + 1] & 192) !== 128)
          return false;
        if ((buffer[i + 2] & 192) !== 128)
          return false;
        const codePoint = (byte & 15) << 12 | (buffer[i + 1] & 63) << 6 | buffer[i + 2] & 63;
        if (codePoint < 2048)
          return false;
        if (codePoint >= 55296 && codePoint <= 57343)
          return false;
        i += 3;
        continue;
      }
      if ((byte & 248) === 240) {
        if (i + 3 >= buffer.length)
          return false;
        if ((buffer[i + 1] & 192) !== 128)
          return false;
        if ((buffer[i + 2] & 192) !== 128)
          return false;
        if ((buffer[i + 3] & 192) !== 128)
          return false;
        const codePoint = (byte & 7) << 18 | (buffer[i + 1] & 63) << 12 | (buffer[i + 2] & 63) << 6 | buffer[i + 3] & 63;
        if (codePoint < 65536)
          return false;
        if (codePoint > 1114111)
          return false;
        i += 4;
        continue;
      }
      return false;
    }
    return true;
  }
  var UBBOpReturnData = class _UBBOpReturnData {
    constructor(opReturnData) {
      this._rawData = opReturnData;
      this._errors = [];
      this._magicBytes = import_buffer.Buffer.alloc(0);
      this._version = 0;
      this._transactionType = 0;
      this._x0 = 0;
      this._y0 = 0;
      this._bmpData = null;
      this._isValid = false;
      this._uri = null;
      try {
        this._parseOpReturnData(opReturnData);
        this._isValid = this._errors.length === 0;
      } catch (error) {
        this._errors.push(`Failed to parse OP_RETURN data: ${error instanceof Error ? error.message : "Unknown error"}`);
        this._isValid = false;
      }
    }
    /**
     * Whether the OP_RETURN data is valid
     */
    get isValid() {
      return this._isValid;
    }
    /**
     * Array of parsing errors
     */
    get errors() {
      return this._errors;
    }
    /**
     * Magic bytes (0x13 0x37)
     */
    get magicBytes() {
      return this._magicBytes;
    }
    /**
     * Version number
     */
    get version() {
      return this._version;
    }
    /**
     * Transaction type (1=CLAIM, 2=RETRY-CLAIM, 3=UPDATE, 4=TRANSFER)
     */
    get transactionType() {
      return this._transactionType;
    }
    /**
     * Transaction type as string
     */
    get transactionTypeString() {
      switch (this._transactionType) {
        case 1:
          return "CLAIM";
        case 2:
          return "RETRY-CLAIM";
        case 3:
          return "UPDATE";
        case 4:
          return "TRANSFER";
        default:
          return "UNKNOWN";
      }
    }
    /**
     * X coordinate
     */
    get x0() {
      return this._x0;
    }
    /**
     * Y coordinate
     */
    get y0() {
      return this._y0;
    }
    /**
     * BMP data (only for CLAIM and UPDATE transactions)
     */
    get bmpData() {
      return this._bmpData;
    }
    /**
     * Optional URI string (present when flags bit 0 set on CLAIM/UPDATE)
     */
    get uri() {
      return this._uri;
    }
    /**
     * Raw OP_RETURN data
     */
    get rawData() {
      return this._rawData;
    }
    /**
     * Whether this is a CLAIM transaction
     */
    get isClaim() {
      return this._transactionType === 1;
    }
    /**
     * Whether this is a RETRY-CLAIM transaction
     */
    get isRetryClaim() {
      return this._transactionType === 2;
    }
    /**
     * Whether this is an UPDATE transaction
     */
    get isUpdate() {
      return this._transactionType === 3;
    }
    /**
     * Whether this is a TRANSFER transaction
     */
    get isTransfer() {
      return this._transactionType === 4;
    }
    /**
     * Whether this transaction type requires BMP data
     */
    get requiresBmpData() {
      return this.isClaim || this.isUpdate;
    }
    /**
     * Whether this transaction type requires coordinates
     */
    get requiresCoordinates() {
      return this.isClaim || this.isRetryClaim || this.isUpdate;
    }
    _parseOpReturnData(data) {
      if (data.length < 8) {
        this._errors.push("OP_RETURN data too short (minimum 8 bytes required)");
        return;
      }
      let offset = 0;
      const magicBytes = data.subarray(offset, offset + 2);
      offset += 2;
      if (!magicBytes.equals(import_buffer.Buffer.from([19, 55]))) {
        this._errors.push(`Invalid magic bytes: expected 0x13 0x37, got 0x${magicBytes.toString("hex")}`);
      }
      const version = data.readUInt8(offset);
      offset += 1;
      if (version !== 1) {
        this._errors.push(`Unsupported version: expected 0x01, got 0x${version.toString(16).padStart(2, "0")}`);
      }
      const transactionType = data.readUInt8(offset);
      offset += 1;
      if (transactionType < 1 || transactionType > 4) {
        this._errors.push(`Invalid transaction type: ${transactionType}`);
      }
      const x0 = data.readUInt16LE(offset);
      offset += 2;
      const y0 = data.readUInt16LE(offset);
      offset += 2;
      let uri = null;
      if (transactionType === 1 || transactionType === 3) {
        try {
          const slice = data.subarray(offset);
          if (slice.length === 0) {
            this._errors.push("Failed to decode CBOR text string for URI: empty buffer");
          } else {
            const majorType = slice[0] >>> 5;
            if (majorType !== 3) {
              this._errors.push("CBOR text: expected major type 3 (text string)");
            } else {
              const cborLength = this._getCBORTextStringLength(slice);
              if (cborLength === -1) {
                this._errors.push("CBOR text: failed to parse string length from header");
              } else {
                const cborPortion = slice.subarray(0, cborLength);
                const { textBytes, headerLength } = this._extractCBORTextBytes(cborPortion);
                if (textBytes && !isValidUTF8(textBytes)) {
                  this._errors.push("CBOR text: invalid UTF-8 encoding in text string");
                } else {
                  const decoder2 = new Decoder();
                  const decodedValue = decoder2.decode(cborPortion);
                  if (typeof decodedValue !== "string") {
                    this._errors.push("CBOR text: expected a text string");
                  } else {
                    if (decodedValue.includes("\0")) {
                      this._errors.push("CBOR text: URI must not contain null bytes");
                    } else {
                      uri = decodedValue;
                      offset += cborLength;
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          this._errors.push(`Failed to decode CBOR text string for URI: ${e instanceof Error ? e.message : "Unknown error"}`);
        }
      }
      let bmpData = null;
      const requiresBmpData = transactionType === 1 || transactionType === 3;
      if (requiresBmpData) {
        if (offset < data.length) {
          bmpData = data.subarray(offset);
        } else if (offset === data.length) {
          const transactionTypeString = this._getTransactionTypeString(transactionType);
          this._errors.push(`${transactionTypeString} transaction requires BMP data`);
          bmpData = null;
        } else {
          const transactionTypeString = this._getTransactionTypeString(transactionType);
          this._errors.push(`${transactionTypeString} transaction requires BMP data`);
          bmpData = null;
        }
      }
      this._magicBytes = magicBytes;
      this._version = version;
      this._transactionType = transactionType;
      this._x0 = x0;
      this._y0 = y0;
      this._bmpData = bmpData;
      this._uri = uri;
    }
    /**
     * Extract the raw text bytes from a CBOR text string buffer
     * Returns the text content and header length
     */
    _extractCBORTextBytes(buffer) {
      if (buffer.length === 0) {
        return { textBytes: null, headerLength: 0 };
      }
      const firstByte = buffer[0];
      const majorType = firstByte >>> 5;
      if (majorType !== 3) {
        return { textBytes: null, headerLength: 0 };
      }
      const additionalInfo = firstByte & 31;
      if (additionalInfo < 24) {
        const textLength = additionalInfo;
        const headerLength = 1;
        if (buffer.length < headerLength + textLength) {
          return { textBytes: null, headerLength: 0 };
        }
        return {
          textBytes: buffer.subarray(headerLength, headerLength + textLength),
          headerLength
        };
      } else if (additionalInfo === 24) {
        if (buffer.length < 2) {
          return { textBytes: null, headerLength: 0 };
        }
        const textLength = buffer[1];
        const headerLength = 2;
        if (buffer.length < headerLength + textLength) {
          return { textBytes: null, headerLength: 0 };
        }
        return {
          textBytes: buffer.subarray(headerLength, headerLength + textLength),
          headerLength
        };
      } else if (additionalInfo === 25) {
        if (buffer.length < 3) {
          return { textBytes: null, headerLength: 0 };
        }
        const textLength = buffer.readUInt16BE(1);
        const headerLength = 3;
        if (buffer.length < headerLength + textLength) {
          return { textBytes: null, headerLength: 0 };
        }
        return {
          textBytes: buffer.subarray(headerLength, headerLength + textLength),
          headerLength
        };
      } else if (additionalInfo === 26) {
        if (buffer.length < 5) {
          return { textBytes: null, headerLength: 0 };
        }
        const textLength = buffer.readUInt32BE(1);
        const headerLength = 5;
        if (buffer.length < headerLength + textLength) {
          return { textBytes: null, headerLength: 0 };
        }
        return {
          textBytes: buffer.subarray(headerLength, headerLength + textLength),
          headerLength
        };
      }
      return { textBytes: null, headerLength: 0 };
    }
    /**
     * Parses CBOR definite-length text string header to determine total byte length
     * (header + string data). Returns -1 on error.
     * 
     * This reads the standard CBOR text string format (major type 3):
     * - Additional info 0-23: length in low 5 bits (1-byte header)
     * - Additional info 24: 1-byte length follows (2-byte header)
     * - Additional info 25: 2-byte length follows (3-byte header)
     * - Additional info 26: 4-byte length follows (5-byte header)
     * 
     * All actual CBOR encoding/decoding is delegated to cbor-x.
     */
    _getCBORTextStringLength(buffer) {
      if (buffer.length === 0)
        return -1;
      const firstByte = buffer[0];
      const majorType = firstByte >>> 5;
      if (majorType !== 3)
        return -1;
      const additionalInfo = firstByte & 31;
      if (additionalInfo < 24) {
        return 1 + additionalInfo;
      } else if (additionalInfo === 24) {
        if (buffer.length < 2)
          return -1;
        const stringLength = buffer[1];
        return 2 + stringLength;
      } else if (additionalInfo === 25) {
        if (buffer.length < 3)
          return -1;
        const stringLength = buffer.readUInt16BE(1);
        return 3 + stringLength;
      } else if (additionalInfo === 26) {
        if (buffer.length < 5)
          return -1;
        const stringLength = buffer.readUInt32BE(1);
        return 5 + stringLength;
      } else {
        return -1;
      }
    }
    _getTransactionTypeString(transactionType) {
      switch (transactionType) {
        case 1:
          return "CLAIM";
        case 2:
          return "RETRY-CLAIM";
        case 3:
          return "UPDATE";
        case 4:
          return "TRANSFER";
        default:
          return "UNKNOWN";
      }
    }
    /**
     * Creates UBBOpReturnData from raw OP_RETURN bytes
     */
    static fromOpReturnData(data) {
      return new _UBBOpReturnData(data);
    }
    /**
     * Creates UBBOpReturnData from Bitcoin transaction's OP_RETURN output
     */
    static fromBitcoinTransaction(bitcoinTx) {
      if (!bitcoinTx.opReturnData) {
        return null;
      }
      return new _UBBOpReturnData(bitcoinTx.opReturnData);
    }
  };

  // src/ubb-bmp.ts
  init_buffer_shim();
  var bmpjs = require_bmp_js();
  var UBBBMP = class {
    constructor(buffer) {
      this._bmpData = null;
      this._errors = null;
      this._warnings = null;
      this._isValid = null;
      this._buffer = buffer;
    }
    /**
     * Whether the BMP is valid according to UBB protocol rules
     */
    get isValid() {
      this._ensureValidated();
      return this._isValid;
    }
    /**
     * Array of validation errors
     */
    get validationErrors() {
      this._ensureValidated();
      return this._errors;
    }
    /**
     * Array of validation warnings
     */
    get validationWarnings() {
      this._ensureValidated();
      return this._warnings;
    }
    /**
     * BMP width in pixels
     */
    get width() {
      this._ensureValidated();
      return this._bmpData.width;
    }
    /**
     * BMP height in pixels
     */
    get height() {
      this._ensureValidated();
      return this._bmpData.height;
    }
    /**
     * Bits per pixel (24 or 32)
     */
    get bitsPerPixel() {
      this._ensureValidated();
      return this._bmpData.bitPP;
    }
    /**
     * Compression type (should be 0 for BI_RGB)
     */
    get compression() {
      this._ensureValidated();
      return this._bmpData.compress;
    }
    /**
     * Actual file size in bytes
     */
    get fileSize() {
      this._ensureValidated();
      return this._bmpData.fileSize;
    }
    /**
     * Expected file size based on dimensions
     */
    get expectedFileSize() {
      this._ensureValidated();
      return this.calculateExpectedFileSize(this._bmpData);
    }
    /**
     * Row stride in bytes (padded to 4-byte boundary)
     */
    get stride() {
      this._ensureValidated();
      return this.calculateStride(this._bmpData.width, this._bmpData.bitPP);
    }
    /**
     * Plot area in pixels
     */
    get area() {
      return this.width * this.height;
    }
    /**
     * Absolute height for placement (handles BMP top-down vs bottom-up)
     */
    get absoluteHeight() {
      return Math.abs(this.height);
    }
    /**
     * Whether this is a 24-bit RGB BMP
     */
    get is24Bit() {
      return this.bitsPerPixel === 24;
    }
    /**
     * Whether this is a 32-bit RGBA BMP
     */
    get is32Bit() {
      return this.bitsPerPixel === 32;
    }
    /**
     * Whether compression is BI_RGB (uncompressed)
     */
    get isUncompressed() {
      return this.compression === 0;
    }
    /**
     * Whether file size matches expected size
     */
    get hasCorrectFileSize() {
      return this.fileSize === this.expectedFileSize;
    }
    /**
     * Get detailed validation report
     */
    getValidationReport() {
      this._ensureValidated();
      return {
        isValid: this._isValid,
        errors: this._errors,
        warnings: this._warnings,
        bmpInfo: {
          width: this.width,
          height: this.height,
          bitsPerPixel: this.bitsPerPixel,
          compression: this.compression,
          fileSize: this.fileSize,
          expectedFileSize: this.expectedFileSize,
          stride: this.stride
        }
      };
    }
    /**
     * Ensures validation has been performed (lazy initialization)
     */
    _ensureValidated() {
      if (this._isValid !== null) {
        return;
      }
      const validation = this._validateBMP();
      this._bmpData = validation.bmpData;
      this._errors = validation.errors;
      this._warnings = validation.warnings;
      this._isValid = validation.isValid;
    }
    _validateBMP() {
      const errors = [];
      const warnings = [];
      let isValid = true;
      let bmpData;
      try {
        const bmpResult = bmpjs.decode(this._buffer);
        bmpData = {
          width: bmpResult.width,
          height: bmpResult.height,
          bitPP: bmpResult.bitPP,
          compress: bmpResult.compress,
          fileSize: bmpResult.fileSize,
          offset: bmpResult.offset,
          rawSize: bmpResult.rawSize,
          is_with_alpha: bmpResult.is_with_alpha,
          bottom_up: bmpResult.bottom_up
        };
        this._validateBMPFormat(bmpData, errors, warnings);
        this._validateFileSize(bmpData, errors, warnings);
        isValid = errors.length === 0;
      } catch (error) {
        isValid = false;
        errors.push(`Failed to parse BMP file: ${error instanceof Error ? error.message : "Unknown error"}`);
        bmpData = {
          width: 0,
          height: 0,
          bitPP: 0,
          compress: -1,
          fileSize: 0,
          offset: 0,
          rawSize: 0,
          is_with_alpha: false,
          bottom_up: false
        };
      }
      return {
        bmpData,
        errors: Object.freeze([...errors]),
        warnings: Object.freeze([...warnings]),
        isValid
      };
    }
    calculateStride(width, bitsPerPixel) {
      const bytesPerPixel = bitsPerPixel / 8;
      return Math.ceil(width * bytesPerPixel / 4) * 4;
    }
    calculateExpectedFileSize(bmpData) {
      const stride = this.calculateStride(bmpData.width, bmpData.bitPP);
      return bmpData.offset + stride * Math.abs(bmpData.height);
    }
    _validateBMPFormat(bmpData, errors, warnings) {
      if (bmpData.bitPP !== 24 && bmpData.bitPP !== 32) {
        errors.push(`Invalid bits per pixel: ${bmpData.bitPP}. Must be 24 or 32.`);
      }
      if (bmpData.compress !== 0) {
        errors.push(`Invalid compression: ${bmpData.compress}. Must be BI_RGB (0) - uncompressed only.`);
      }
      if (bmpData.width === 0 || bmpData.height === 0) {
        errors.push(`Zero-sized plots are forbidden. Width: ${bmpData.width}, Height: ${bmpData.height}`);
      }
      if (bmpData.width < 0 || bmpData.height < 0) {
        errors.push(`Negative dimensions not allowed. Width: ${bmpData.width}, Height: ${bmpData.height}`);
      }
    }
    _validateFileSize(bmpData, errors, warnings) {
      const expectedSize = this.calculateExpectedFileSize(bmpData);
      const actualBufferSize = this._buffer.length;
      if (bmpData.fileSize !== expectedSize) {
        errors.push(
          `File size mismatch. Expected: ${expectedSize} bytes, Actual: ${bmpData.fileSize} bytes. This indicates the BMP file may be corrupted or not properly formatted.`
        );
      }
      if (actualBufferSize !== bmpData.fileSize) {
        errors.push(
          `Buffer size mismatch. Header claims: ${bmpData.fileSize} bytes, Buffer contains: ${actualBufferSize} bytes. This indicates the BMP file has been truncated or padded.`
        );
      }
    }
  };

  // src/browser/verifier.ts
  if (typeof window !== "undefined") {
    window.UBBVerifier = {
      UBBOpReturnData,
      UBBBMP
    };
  }
  return __toCommonJS(verifier_exports);
})();
/*! Bundled license information:

ieee754/index.js:
  (*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> *)

buffer/index.js:
  (*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)
*/
//# sourceMappingURL=verifier.bundle.js.map
