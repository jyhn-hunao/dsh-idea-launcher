var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/util.js
var require_util = __commonJS({
  "node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/util.js"(exports) {
    "use strict";
    var nameStartChar = ":A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
    var nameChar = nameStartChar + "\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
    var nameRegexp = "[" + nameStartChar + "][" + nameChar + "]*";
    var regexName = new RegExp("^" + nameRegexp + "$");
    var getAllMatches = function(string, regex) {
      const matches = [];
      let match = regex.exec(string);
      while (match) {
        const allmatches = [];
        allmatches.startIndex = regex.lastIndex - match[0].length;
        const len = match.length;
        for (let index = 0; index < len; index++) {
          allmatches.push(match[index]);
        }
        matches.push(allmatches);
        match = regex.exec(string);
      }
      return matches;
    };
    var isName = function(string) {
      const match = regexName.exec(string);
      return !(match === null || typeof match === "undefined");
    };
    exports.isExist = function(v) {
      return typeof v !== "undefined";
    };
    exports.isEmptyObject = function(obj) {
      return Object.keys(obj).length === 0;
    };
    exports.merge = function(target, a, arrayMode) {
      if (a) {
        const keys = Object.keys(a);
        const len = keys.length;
        for (let i = 0; i < len; i++) {
          if (arrayMode === "strict") {
            target[keys[i]] = [a[keys[i]]];
          } else {
            target[keys[i]] = a[keys[i]];
          }
        }
      }
    };
    exports.getValue = function(v) {
      if (exports.isExist(v)) {
        return v;
      } else {
        return "";
      }
    };
    var DANGEROUS_PROPERTY_NAMES = [
      // '__proto__',
      // 'constructor',
      // 'prototype',
      "hasOwnProperty",
      "toString",
      "valueOf",
      "__defineGetter__",
      "__defineSetter__",
      "__lookupGetter__",
      "__lookupSetter__"
    ];
    var criticalProperties = ["__proto__", "constructor", "prototype"];
    exports.isName = isName;
    exports.getAllMatches = getAllMatches;
    exports.nameRegexp = nameRegexp;
    exports.DANGEROUS_PROPERTY_NAMES = DANGEROUS_PROPERTY_NAMES;
    exports.criticalProperties = criticalProperties;
  }
});

// node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/validator.js
var require_validator = __commonJS({
  "node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/validator.js"(exports) {
    "use strict";
    var util = require_util();
    var defaultOptions = {
      allowBooleanAttributes: false,
      //A tag can have attributes without any value
      unpairedTags: []
    };
    exports.validate = function(xmlData, options) {
      options = Object.assign({}, defaultOptions, options);
      const tags = [];
      let tagFound = false;
      let reachedRoot = false;
      if (xmlData[0] === "\uFEFF") {
        xmlData = xmlData.substr(1);
      }
      for (let i = 0; i < xmlData.length; i++) {
        if (xmlData[i] === "<" && xmlData[i + 1] === "?") {
          i += 2;
          i = readPI(xmlData, i);
          if (i.err) return i;
        } else if (xmlData[i] === "<") {
          let tagStartPos = i;
          i++;
          if (xmlData[i] === "!") {
            i = readCommentAndCDATA(xmlData, i);
            continue;
          } else {
            let closingTag = false;
            if (xmlData[i] === "/") {
              closingTag = true;
              i++;
            }
            let tagName = "";
            for (; i < xmlData.length && xmlData[i] !== ">" && xmlData[i] !== " " && xmlData[i] !== "	" && xmlData[i] !== "\n" && xmlData[i] !== "\r"; i++) {
              tagName += xmlData[i];
            }
            tagName = tagName.trim();
            if (tagName[tagName.length - 1] === "/") {
              tagName = tagName.substring(0, tagName.length - 1);
              i--;
            }
            if (!validateTagName(tagName)) {
              let msg;
              if (tagName.trim().length === 0) {
                msg = "Invalid space after '<'.";
              } else {
                msg = "Tag '" + tagName + "' is an invalid name.";
              }
              return getErrorObject("InvalidTag", msg, getLineNumberForPosition(xmlData, i));
            }
            const result = readAttributeStr(xmlData, i);
            if (result === false) {
              return getErrorObject("InvalidAttr", "Attributes for '" + tagName + "' have open quote.", getLineNumberForPosition(xmlData, i));
            }
            let attrStr = result.value;
            i = result.index;
            if (attrStr[attrStr.length - 1] === "/") {
              const attrStrStart = i - attrStr.length;
              attrStr = attrStr.substring(0, attrStr.length - 1);
              const isValid = validateAttributeString(attrStr, options);
              if (isValid === true) {
                tagFound = true;
              } else {
                return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, attrStrStart + isValid.err.line));
              }
            } else if (closingTag) {
              if (!result.tagClosed) {
                return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' doesn't have proper closing.", getLineNumberForPosition(xmlData, i));
              } else if (attrStr.trim().length > 0) {
                return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' can't have attributes or invalid starting.", getLineNumberForPosition(xmlData, tagStartPos));
              } else if (tags.length === 0) {
                return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' has not been opened.", getLineNumberForPosition(xmlData, tagStartPos));
              } else {
                const otg = tags.pop();
                if (tagName !== otg.tagName) {
                  let openPos = getLineNumberForPosition(xmlData, otg.tagStartPos);
                  return getErrorObject(
                    "InvalidTag",
                    "Expected closing tag '" + otg.tagName + "' (opened in line " + openPos.line + ", col " + openPos.col + ") instead of closing tag '" + tagName + "'.",
                    getLineNumberForPosition(xmlData, tagStartPos)
                  );
                }
                if (tags.length == 0) {
                  reachedRoot = true;
                }
              }
            } else {
              const isValid = validateAttributeString(attrStr, options);
              if (isValid !== true) {
                return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line));
              }
              if (reachedRoot === true) {
                return getErrorObject("InvalidXml", "Multiple possible root nodes found.", getLineNumberForPosition(xmlData, i));
              } else if (options.unpairedTags.indexOf(tagName) !== -1) {
              } else {
                tags.push({ tagName, tagStartPos });
              }
              tagFound = true;
            }
            for (i++; i < xmlData.length; i++) {
              if (xmlData[i] === "<") {
                if (xmlData[i + 1] === "!") {
                  i++;
                  i = readCommentAndCDATA(xmlData, i);
                  continue;
                } else if (xmlData[i + 1] === "?") {
                  i = readPI(xmlData, ++i);
                  if (i.err) return i;
                } else {
                  break;
                }
              } else if (xmlData[i] === "&") {
                const afterAmp = validateAmpersand(xmlData, i);
                if (afterAmp == -1)
                  return getErrorObject("InvalidChar", "char '&' is not expected.", getLineNumberForPosition(xmlData, i));
                i = afterAmp;
              } else {
                if (reachedRoot === true && !isWhiteSpace(xmlData[i])) {
                  return getErrorObject("InvalidXml", "Extra text at the end", getLineNumberForPosition(xmlData, i));
                }
              }
            }
            if (xmlData[i] === "<") {
              i--;
            }
          }
        } else {
          if (isWhiteSpace(xmlData[i])) {
            continue;
          }
          return getErrorObject("InvalidChar", "char '" + xmlData[i] + "' is not expected.", getLineNumberForPosition(xmlData, i));
        }
      }
      if (!tagFound) {
        return getErrorObject("InvalidXml", "Start tag expected.", 1);
      } else if (tags.length == 1) {
        return getErrorObject("InvalidTag", "Unclosed tag '" + tags[0].tagName + "'.", getLineNumberForPosition(xmlData, tags[0].tagStartPos));
      } else if (tags.length > 0) {
        return getErrorObject("InvalidXml", "Invalid '" + JSON.stringify(tags.map((t) => t.tagName), null, 4).replace(/\r?\n/g, "") + "' found.", { line: 1, col: 1 });
      }
      return true;
    };
    function isWhiteSpace(char) {
      return char === " " || char === "	" || char === "\n" || char === "\r";
    }
    function readPI(xmlData, i) {
      const start = i;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] == "?" || xmlData[i] == " ") {
          const tagname = xmlData.substr(start, i - start);
          if (i > 5 && tagname === "xml") {
            return getErrorObject("InvalidXml", "XML declaration allowed only at the start of the document.", getLineNumberForPosition(xmlData, i));
          } else if (xmlData[i] == "?" && xmlData[i + 1] == ">") {
            i++;
            break;
          } else {
            continue;
          }
        }
      }
      return i;
    }
    function readCommentAndCDATA(xmlData, i) {
      if (xmlData.length > i + 5 && xmlData[i + 1] === "-" && xmlData[i + 2] === "-") {
        for (i += 3; i < xmlData.length; i++) {
          if (xmlData[i] === "-" && xmlData[i + 1] === "-" && xmlData[i + 2] === ">") {
            i += 2;
            break;
          }
        }
      } else if (xmlData.length > i + 8 && xmlData[i + 1] === "D" && xmlData[i + 2] === "O" && xmlData[i + 3] === "C" && xmlData[i + 4] === "T" && xmlData[i + 5] === "Y" && xmlData[i + 6] === "P" && xmlData[i + 7] === "E") {
        let angleBracketsCount = 1;
        for (i += 8; i < xmlData.length; i++) {
          if (xmlData[i] === "<") {
            angleBracketsCount++;
          } else if (xmlData[i] === ">") {
            angleBracketsCount--;
            if (angleBracketsCount === 0) {
              break;
            }
          }
        }
      } else if (xmlData.length > i + 9 && xmlData[i + 1] === "[" && xmlData[i + 2] === "C" && xmlData[i + 3] === "D" && xmlData[i + 4] === "A" && xmlData[i + 5] === "T" && xmlData[i + 6] === "A" && xmlData[i + 7] === "[") {
        for (i += 8; i < xmlData.length; i++) {
          if (xmlData[i] === "]" && xmlData[i + 1] === "]" && xmlData[i + 2] === ">") {
            i += 2;
            break;
          }
        }
      }
      return i;
    }
    var doubleQuote = '"';
    var singleQuote = "'";
    function readAttributeStr(xmlData, i) {
      let attrStr = "";
      let startChar = "";
      let tagClosed = false;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === doubleQuote || xmlData[i] === singleQuote) {
          if (startChar === "") {
            startChar = xmlData[i];
          } else if (startChar !== xmlData[i]) {
          } else {
            startChar = "";
          }
        } else if (xmlData[i] === ">") {
          if (startChar === "") {
            tagClosed = true;
            break;
          }
        }
        attrStr += xmlData[i];
      }
      if (startChar !== "") {
        return false;
      }
      return {
        value: attrStr,
        index: i,
        tagClosed
      };
    }
    var validAttrStrRegxp = new RegExp(`(\\s*)([^\\s=]+)(\\s*=)?(\\s*(['"])(([\\s\\S])*?)\\5)?`, "g");
    function validateAttributeString(attrStr, options) {
      const matches = util.getAllMatches(attrStr, validAttrStrRegxp);
      const attrNames = {};
      for (let i = 0; i < matches.length; i++) {
        if (matches[i][1].length === 0) {
          return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' has no space in starting.", getPositionFromMatch(matches[i]));
        } else if (matches[i][3] !== void 0 && matches[i][4] === void 0) {
          return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' is without value.", getPositionFromMatch(matches[i]));
        } else if (matches[i][3] === void 0 && !options.allowBooleanAttributes) {
          return getErrorObject("InvalidAttr", "boolean attribute '" + matches[i][2] + "' is not allowed.", getPositionFromMatch(matches[i]));
        }
        const attrName = matches[i][2];
        if (!validateAttrName(attrName)) {
          return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is an invalid name.", getPositionFromMatch(matches[i]));
        }
        if (!attrNames.hasOwnProperty(attrName)) {
          attrNames[attrName] = 1;
        } else {
          return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is repeated.", getPositionFromMatch(matches[i]));
        }
      }
      return true;
    }
    function validateNumberAmpersand(xmlData, i) {
      let re = /\d/;
      if (xmlData[i] === "x") {
        i++;
        re = /[\da-fA-F]/;
      }
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === ";")
          return i;
        if (!xmlData[i].match(re))
          break;
      }
      return -1;
    }
    function validateAmpersand(xmlData, i) {
      i++;
      if (xmlData[i] === ";")
        return -1;
      if (xmlData[i] === "#") {
        i++;
        return validateNumberAmpersand(xmlData, i);
      }
      let count = 0;
      for (; i < xmlData.length; i++, count++) {
        if (xmlData[i].match(/\w/) && count < 20)
          continue;
        if (xmlData[i] === ";")
          break;
        return -1;
      }
      return i;
    }
    function getErrorObject(code, message, lineNumber) {
      return {
        err: {
          code,
          msg: message,
          line: lineNumber.line || lineNumber,
          col: lineNumber.col
        }
      };
    }
    function validateAttrName(attrName) {
      return util.isName(attrName);
    }
    function validateTagName(tagname) {
      return util.isName(tagname);
    }
    function getLineNumberForPosition(xmlData, index) {
      const lines = xmlData.substring(0, index).split(/\r?\n/);
      return {
        line: lines.length,
        // column number is last line's length + 1, because column numbering starts at 1:
        col: lines[lines.length - 1].length + 1
      };
    }
    function getPositionFromMatch(match) {
      return match.startIndex + match[1].length;
    }
  }
});

// node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js
var require_OptionsBuilder = __commonJS({
  "node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js"(exports) {
    var { DANGEROUS_PROPERTY_NAMES, criticalProperties } = require_util();
    var defaultOnDangerousProperty = (name2) => {
      if (DANGEROUS_PROPERTY_NAMES.includes(name2)) {
        return "__" + name2;
      }
      return name2;
    };
    var defaultOptions = {
      preserveOrder: false,
      attributeNamePrefix: "@_",
      attributesGroupName: false,
      textNodeName: "#text",
      ignoreAttributes: true,
      removeNSPrefix: false,
      // remove NS from tag name or attribute name if true
      allowBooleanAttributes: false,
      //a tag can have attributes without any value
      //ignoreRootElement : false,
      parseTagValue: true,
      parseAttributeValue: false,
      trimValues: true,
      //Trim string values of tag and attributes
      cdataPropName: false,
      numberParseOptions: {
        hex: true,
        leadingZeros: true,
        eNotation: true
      },
      tagValueProcessor: function(tagName, val) {
        return val;
      },
      attributeValueProcessor: function(attrName, val) {
        return val;
      },
      stopNodes: [],
      //nested tags will not be parsed even for errors
      alwaysCreateTextNode: false,
      isArray: () => false,
      commentPropName: false,
      unpairedTags: [],
      processEntities: true,
      htmlEntities: false,
      ignoreDeclaration: false,
      ignorePiTags: false,
      transformTagName: false,
      transformAttributeName: false,
      updateTag: function(tagName, jPath, attrs) {
        return tagName;
      },
      // skipEmptyListItem: false
      captureMetaData: false,
      maxNestedTags: 100,
      strictReservedNames: true,
      onDangerousProperty: defaultOnDangerousProperty
    };
    function validatePropertyName(propertyName, optionName) {
      if (typeof propertyName !== "string") {
        return;
      }
      const normalized = propertyName.toLowerCase();
      if (DANGEROUS_PROPERTY_NAMES.some((dangerous) => normalized === dangerous.toLowerCase())) {
        throw new Error(
          `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
        );
      }
      if (criticalProperties.some((dangerous) => normalized === dangerous.toLowerCase())) {
        throw new Error(
          `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
        );
      }
    }
    function normalizeProcessEntities(value) {
      if (typeof value === "boolean") {
        return {
          enabled: value,
          // true or false
          maxEntitySize: 1e4,
          maxExpansionDepth: 10,
          maxTotalExpansions: 1e3,
          maxExpandedLength: 1e5,
          allowedTags: null,
          tagFilter: null
        };
      }
      if (typeof value === "object" && value !== null) {
        return {
          enabled: value.enabled !== false,
          maxEntitySize: Math.max(1, value.maxEntitySize ?? 1e4),
          maxExpansionDepth: Math.max(1, value.maxExpansionDepth ?? 1e4),
          maxTotalExpansions: Math.max(1, value.maxTotalExpansions ?? Infinity),
          maxExpandedLength: Math.max(1, value.maxExpandedLength ?? 1e5),
          maxEntityCount: Math.max(1, value.maxEntityCount ?? 1e3),
          allowedTags: value.allowedTags ?? null,
          tagFilter: value.tagFilter ?? null
        };
      }
      return normalizeProcessEntities(true);
    }
    var buildOptions = function(options) {
      const built = Object.assign({}, defaultOptions, options);
      const propertyNameOptions = [
        { value: built.attributeNamePrefix, name: "attributeNamePrefix" },
        { value: built.attributesGroupName, name: "attributesGroupName" },
        { value: built.textNodeName, name: "textNodeName" },
        { value: built.cdataPropName, name: "cdataPropName" },
        { value: built.commentPropName, name: "commentPropName" }
      ];
      for (const { value, name: name2 } of propertyNameOptions) {
        if (value) {
          validatePropertyName(value, name2);
        }
      }
      if (built.onDangerousProperty === null) {
        built.onDangerousProperty = defaultOnDangerousProperty;
      }
      built.processEntities = normalizeProcessEntities(built.processEntities);
      return built;
    };
    exports.buildOptions = buildOptions;
    exports.defaultOptions = defaultOptions;
  }
});

// node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlparser/xmlNode.js
var require_xmlNode = __commonJS({
  "node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlparser/xmlNode.js"(exports, module) {
    "use strict";
    var XmlNode = class {
      constructor(tagname) {
        this.tagname = tagname;
        this.child = [];
        this[":@"] = {};
      }
      add(key, val) {
        if (key === "__proto__") key = "#__proto__";
        this.child.push({ [key]: val });
      }
      addChild(node) {
        if (node.tagname === "__proto__") node.tagname = "#__proto__";
        if (node[":@"] && Object.keys(node[":@"]).length > 0) {
          this.child.push({ [node.tagname]: node.child, [":@"]: node[":@"] });
        } else {
          this.child.push({ [node.tagname]: node.child });
        }
      }
    };
    module.exports = XmlNode;
  }
});

// node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js
var require_DocTypeReader = __commonJS({
  "node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js"(exports, module) {
    var util = require_util();
    var DocTypeReader = class {
      constructor(options) {
        this.suppressValidationErr = !options;
        this.options = options || {};
      }
      readDocType(xmlData, i) {
        const entities = /* @__PURE__ */ Object.create(null);
        let entityCount = 0;
        if (xmlData[i + 3] === "O" && xmlData[i + 4] === "C" && xmlData[i + 5] === "T" && xmlData[i + 6] === "Y" && xmlData[i + 7] === "P" && xmlData[i + 8] === "E") {
          i = i + 9;
          let angleBracketsCount = 1;
          let hasBody = false, comment = false;
          let exp = "";
          for (; i < xmlData.length; i++) {
            if (xmlData[i] === "<" && !comment) {
              if (hasBody && hasSeq(xmlData, "!ENTITY", i)) {
                i += 7;
                let entityName, val;
                [entityName, val, i] = this.readEntityExp(xmlData, i + 1, this.suppressValidationErr);
                if (val.indexOf("&") === -1) {
                  if (this.options.enabled !== false && this.options.maxEntityCount != null && entityCount >= this.options.maxEntityCount) {
                    throw new Error(
                      `Entity count (${entityCount + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`
                    );
                  }
                  const escaped = entityName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  entities[entityName] = {
                    regx: RegExp(`&${escaped};`, "g"),
                    val
                  };
                  entityCount++;
                }
              } else if (hasBody && hasSeq(xmlData, "!ELEMENT", i)) {
                i += 8;
                const { index } = this.readElementExp(xmlData, i + 1);
                i = index;
              } else if (hasBody && hasSeq(xmlData, "!ATTLIST", i)) {
                i += 8;
              } else if (hasBody && hasSeq(xmlData, "!NOTATION", i)) {
                i += 9;
                const { index } = this.readNotationExp(xmlData, i + 1, this.suppressValidationErr);
                i = index;
              } else if (hasSeq(xmlData, "!--", i)) {
                comment = true;
              } else {
                throw new Error(`Invalid DOCTYPE`);
              }
              angleBracketsCount++;
              exp = "";
            } else if (xmlData[i] === ">") {
              if (comment) {
                if (xmlData[i - 1] === "-" && xmlData[i - 2] === "-") {
                  comment = false;
                  angleBracketsCount--;
                }
              } else {
                angleBracketsCount--;
              }
              if (angleBracketsCount === 0) {
                break;
              }
            } else if (xmlData[i] === "[") {
              hasBody = true;
            } else {
              exp += xmlData[i];
            }
          }
          if (angleBracketsCount !== 0) {
            throw new Error(`Unclosed DOCTYPE`);
          }
        } else {
          throw new Error(`Invalid Tag instead of DOCTYPE`);
        }
        return { entities, i };
      }
      readEntityExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let entityName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i]) && xmlData[i] !== '"' && xmlData[i] !== "'") {
          entityName += xmlData[i];
          i++;
        }
        validateEntityName(entityName);
        i = skipWhitespace(xmlData, i);
        if (!this.suppressValidationErr) {
          if (xmlData.substring(i, i + 6).toUpperCase() === "SYSTEM") {
            throw new Error("External entities are not supported");
          } else if (xmlData[i] === "%") {
            throw new Error("Parameter entities are not supported");
          }
        }
        let entityValue = "";
        [i, entityValue] = this.readIdentifierVal(xmlData, i, "entity");
        if (this.options.enabled !== false && this.options.maxEntitySize != null && entityValue.length > this.options.maxEntitySize) {
          throw new Error(
            `Entity "${entityName}" size (${entityValue.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`
          );
        }
        i--;
        return [entityName, entityValue, i];
      }
      readNotationExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let notationName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          notationName += xmlData[i];
          i++;
        }
        !this.suppressValidationErr && validateEntityName(notationName);
        i = skipWhitespace(xmlData, i);
        const identifierType = xmlData.substring(i, i + 6).toUpperCase();
        if (!this.suppressValidationErr && identifierType !== "SYSTEM" && identifierType !== "PUBLIC") {
          throw new Error(`Expected SYSTEM or PUBLIC, found "${identifierType}"`);
        }
        i += identifierType.length;
        i = skipWhitespace(xmlData, i);
        let publicIdentifier = null;
        let systemIdentifier = null;
        if (identifierType === "PUBLIC") {
          [i, publicIdentifier] = this.readIdentifierVal(xmlData, i, "publicIdentifier");
          i = skipWhitespace(xmlData, i);
          if (xmlData[i] === '"' || xmlData[i] === "'") {
            [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
          }
        } else if (identifierType === "SYSTEM") {
          [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
          if (!this.suppressValidationErr && !systemIdentifier) {
            throw new Error("Missing mandatory system identifier for SYSTEM notation");
          }
        }
        return { notationName, publicIdentifier, systemIdentifier, index: --i };
      }
      readIdentifierVal(xmlData, i, type) {
        let identifierVal = "";
        const startChar = xmlData[i];
        if (startChar !== '"' && startChar !== "'") {
          throw new Error(`Expected quoted string, found "${startChar}"`);
        }
        i++;
        while (i < xmlData.length && xmlData[i] !== startChar) {
          identifierVal += xmlData[i];
          i++;
        }
        if (xmlData[i] !== startChar) {
          throw new Error(`Unterminated ${type} value`);
        }
        i++;
        return [i, identifierVal];
      }
      readElementExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let elementName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          elementName += xmlData[i];
          i++;
        }
        if (!this.suppressValidationErr && !util.isName(elementName)) {
          throw new Error(`Invalid element name: "${elementName}"`);
        }
        i = skipWhitespace(xmlData, i);
        let contentModel = "";
        if (xmlData[i] === "E" && hasSeq(xmlData, "MPTY", i)) {
          i += 4;
        } else if (xmlData[i] === "A" && hasSeq(xmlData, "NY", i)) {
          i += 2;
        } else if (xmlData[i] === "(") {
          i++;
          while (i < xmlData.length && xmlData[i] !== ")") {
            contentModel += xmlData[i];
            i++;
          }
          if (xmlData[i] !== ")") {
            throw new Error("Unterminated content model");
          }
        } else if (!this.suppressValidationErr) {
          throw new Error(`Invalid Element Expression, found "${xmlData[i]}"`);
        }
        return {
          elementName,
          contentModel: contentModel.trim(),
          index: i
        };
      }
      readAttlistExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let elementName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          elementName += xmlData[i];
          i++;
        }
        validateEntityName(elementName);
        i = skipWhitespace(xmlData, i);
        let attributeName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          attributeName += xmlData[i];
          i++;
        }
        if (!validateEntityName(attributeName)) {
          throw new Error(`Invalid attribute name: "${attributeName}"`);
        }
        i = skipWhitespace(xmlData, i);
        let attributeType = "";
        if (xmlData.substring(i, i + 8).toUpperCase() === "NOTATION") {
          attributeType = "NOTATION";
          i += 8;
          i = skipWhitespace(xmlData, i);
          if (xmlData[i] !== "(") {
            throw new Error(`Expected '(', found "${xmlData[i]}"`);
          }
          i++;
          let allowedNotations = [];
          while (i < xmlData.length && xmlData[i] !== ")") {
            let notation = "";
            while (i < xmlData.length && xmlData[i] !== "|" && xmlData[i] !== ")") {
              notation += xmlData[i];
              i++;
            }
            notation = notation.trim();
            if (!validateEntityName(notation)) {
              throw new Error(`Invalid notation name: "${notation}"`);
            }
            allowedNotations.push(notation);
            if (xmlData[i] === "|") {
              i++;
              i = skipWhitespace(xmlData, i);
            }
          }
          if (xmlData[i] !== ")") {
            throw new Error("Unterminated list of notations");
          }
          i++;
          attributeType += " (" + allowedNotations.join("|") + ")";
        } else {
          while (i < xmlData.length && !/\s/.test(xmlData[i])) {
            attributeType += xmlData[i];
            i++;
          }
          const validTypes = ["CDATA", "ID", "IDREF", "IDREFS", "ENTITY", "ENTITIES", "NMTOKEN", "NMTOKENS"];
          if (!this.suppressValidationErr && !validTypes.includes(attributeType.toUpperCase())) {
            throw new Error(`Invalid attribute type: "${attributeType}"`);
          }
        }
        i = skipWhitespace(xmlData, i);
        let defaultValue = "";
        if (xmlData.substring(i, i + 8).toUpperCase() === "#REQUIRED") {
          defaultValue = "#REQUIRED";
          i += 8;
        } else if (xmlData.substring(i, i + 7).toUpperCase() === "#IMPLIED") {
          defaultValue = "#IMPLIED";
          i += 7;
        } else {
          [i, defaultValue] = this.readIdentifierVal(xmlData, i, "ATTLIST");
        }
        return {
          elementName,
          attributeName,
          attributeType,
          defaultValue,
          index: i
        };
      }
    };
    var skipWhitespace = (data, index) => {
      while (index < data.length && /\s/.test(data[index])) {
        index++;
      }
      return index;
    };
    function hasSeq(data, seq, i) {
      for (let j = 0; j < seq.length; j++) {
        if (seq[j] !== data[i + j + 1]) return false;
      }
      return true;
    }
    function validateEntityName(name2) {
      if (util.isName(name2))
        return name2;
      else
        throw new Error(`Invalid entity name ${name2}`);
    }
    module.exports = DocTypeReader;
  }
});

// node_modules/.pnpm/strnum@1.1.2/node_modules/strnum/strnum.js
var require_strnum = __commonJS({
  "node_modules/.pnpm/strnum@1.1.2/node_modules/strnum/strnum.js"(exports, module) {
    var hexRegex = /^[-+]?0x[a-fA-F0-9]+$/;
    var numRegex = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/;
    var consider = {
      hex: true,
      // oct: false,
      leadingZeros: true,
      decimalPoint: ".",
      eNotation: true
      //skipLike: /regex/
    };
    function toNumber(str, options = {}) {
      options = Object.assign({}, consider, options);
      if (!str || typeof str !== "string") return str;
      let trimmedStr = str.trim();
      if (options.skipLike !== void 0 && options.skipLike.test(trimmedStr)) return str;
      else if (str === "0") return 0;
      else if (options.hex && hexRegex.test(trimmedStr)) {
        return parse_int(trimmedStr, 16);
      } else if (trimmedStr.search(/[eE]/) !== -1) {
        const notation = trimmedStr.match(/^([-\+])?(0*)([0-9]*(\.[0-9]*)?[eE][-\+]?[0-9]+)$/);
        if (notation) {
          if (options.leadingZeros) {
            trimmedStr = (notation[1] || "") + notation[3];
          } else {
            if (notation[2] === "0" && notation[3][0] === ".") {
            } else {
              return str;
            }
          }
          return options.eNotation ? Number(trimmedStr) : str;
        } else {
          return str;
        }
      } else {
        const match = numRegex.exec(trimmedStr);
        if (match) {
          const sign = match[1];
          const leadingZeros = match[2];
          let numTrimmedByZeros = trimZeros(match[3]);
          if (!options.leadingZeros && leadingZeros.length > 0 && sign && trimmedStr[2] !== ".") return str;
          else if (!options.leadingZeros && leadingZeros.length > 0 && !sign && trimmedStr[1] !== ".") return str;
          else if (options.leadingZeros && leadingZeros === str) return 0;
          else {
            const num = Number(trimmedStr);
            const numStr = "" + num;
            if (numStr.search(/[eE]/) !== -1) {
              if (options.eNotation) return num;
              else return str;
            } else if (trimmedStr.indexOf(".") !== -1) {
              if (numStr === "0" && numTrimmedByZeros === "") return num;
              else if (numStr === numTrimmedByZeros) return num;
              else if (sign && numStr === "-" + numTrimmedByZeros) return num;
              else return str;
            }
            if (leadingZeros) {
              return numTrimmedByZeros === numStr || sign + numTrimmedByZeros === numStr ? num : str;
            } else {
              return trimmedStr === numStr || trimmedStr === sign + numStr ? num : str;
            }
          }
        } else {
          return str;
        }
      }
    }
    function trimZeros(numStr) {
      if (numStr && numStr.indexOf(".") !== -1) {
        numStr = numStr.replace(/0+$/, "");
        if (numStr === ".") numStr = "0";
        else if (numStr[0] === ".") numStr = "0" + numStr;
        else if (numStr[numStr.length - 1] === ".") numStr = numStr.substr(0, numStr.length - 1);
        return numStr;
      }
      return numStr;
    }
    function parse_int(numStr, base) {
      if (parseInt) return parseInt(numStr, base);
      else if (Number.parseInt) return Number.parseInt(numStr, base);
      else if (window && window.parseInt) return window.parseInt(numStr, base);
      else throw new Error("parseInt, Number.parseInt, window.parseInt are not supported");
    }
    module.exports = toNumber;
  }
});

// node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/ignoreAttributes.js
var require_ignoreAttributes = __commonJS({
  "node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/ignoreAttributes.js"(exports, module) {
    function getIgnoreAttributesFn(ignoreAttributes) {
      if (typeof ignoreAttributes === "function") {
        return ignoreAttributes;
      }
      if (Array.isArray(ignoreAttributes)) {
        return (attrName) => {
          for (const pattern of ignoreAttributes) {
            if (typeof pattern === "string" && attrName === pattern) {
              return true;
            }
            if (pattern instanceof RegExp && pattern.test(attrName)) {
              return true;
            }
          }
        };
      }
      return () => false;
    }
    module.exports = getIgnoreAttributesFn;
  }
});

// node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js
var require_OrderedObjParser = __commonJS({
  "node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js"(exports, module) {
    "use strict";
    var util = require_util();
    var xmlNode = require_xmlNode();
    var DocTypeReader = require_DocTypeReader();
    var toNumber = require_strnum();
    var getIgnoreAttributesFn = require_ignoreAttributes();
    var OrderedObjParser = class {
      constructor(options) {
        this.options = options;
        this.currentNode = null;
        this.tagsNodeStack = [];
        this.docTypeEntities = {};
        this.lastEntities = {
          "apos": { regex: /&(apos|#39|#x27);/g, val: "'" },
          "gt": { regex: /&(gt|#62|#x3E);/g, val: ">" },
          "lt": { regex: /&(lt|#60|#x3C);/g, val: "<" },
          "quot": { regex: /&(quot|#34|#x22);/g, val: '"' }
        };
        this.ampEntity = { regex: /&(amp|#38|#x26);/g, val: "&" };
        this.htmlEntities = {
          "space": { regex: /&(nbsp|#160);/g, val: " " },
          // "lt" : { regex: /&(lt|#60);/g, val: "<" },
          // "gt" : { regex: /&(gt|#62);/g, val: ">" },
          // "amp" : { regex: /&(amp|#38);/g, val: "&" },
          // "quot" : { regex: /&(quot|#34);/g, val: "\"" },
          // "apos" : { regex: /&(apos|#39);/g, val: "'" },
          "cent": { regex: /&(cent|#162);/g, val: "\xA2" },
          "pound": { regex: /&(pound|#163);/g, val: "\xA3" },
          "yen": { regex: /&(yen|#165);/g, val: "\xA5" },
          "euro": { regex: /&(euro|#8364);/g, val: "\u20AC" },
          "copyright": { regex: /&(copy|#169);/g, val: "\xA9" },
          "reg": { regex: /&(reg|#174);/g, val: "\xAE" },
          "inr": { regex: /&(inr|#8377);/g, val: "\u20B9" },
          "num_dec": { regex: /&#([0-9]{1,7});/g, val: (_, str) => fromCodePoint(str, 10, "&#") },
          "num_hex": { regex: /&#x([0-9a-fA-F]{1,6});/g, val: (_, str) => fromCodePoint(str, 16, "&#x") }
        };
        this.addExternalEntities = addExternalEntities;
        this.parseXml = parseXml;
        this.parseTextData = parseTextData;
        this.resolveNameSpace = resolveNameSpace;
        this.buildAttributesMap = buildAttributesMap;
        this.isItStopNode = isItStopNode;
        this.replaceEntitiesValue = replaceEntitiesValue;
        this.readStopNodeData = readStopNodeData;
        this.saveTextToParentTag = saveTextToParentTag;
        this.addChild = addChild;
        this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
        this.entityExpansionCount = 0;
        this.currentExpandedLength = 0;
        if (this.options.stopNodes && this.options.stopNodes.length > 0) {
          this.stopNodesExact = /* @__PURE__ */ new Set();
          this.stopNodesWildcard = /* @__PURE__ */ new Set();
          for (let i = 0; i < this.options.stopNodes.length; i++) {
            const stopNodeExp = this.options.stopNodes[i];
            if (typeof stopNodeExp !== "string") continue;
            if (stopNodeExp.startsWith("*.")) {
              this.stopNodesWildcard.add(stopNodeExp.substring(2));
            } else {
              this.stopNodesExact.add(stopNodeExp);
            }
          }
        }
      }
    };
    function addExternalEntities(externalEntities) {
      const entKeys = Object.keys(externalEntities);
      for (let i = 0; i < entKeys.length; i++) {
        const ent = entKeys[i];
        const escaped = ent.replace(/[.\-+*:]/g, "\\.");
        this.lastEntities[ent] = {
          regex: new RegExp("&" + escaped + ";", "g"),
          val: externalEntities[ent]
        };
      }
    }
    function parseTextData(val, tagName, jPath, dontTrim, hasAttributes, isLeafNode, escapeEntities) {
      if (val !== void 0) {
        if (this.options.trimValues && !dontTrim) {
          val = val.trim();
        }
        if (val.length > 0) {
          if (!escapeEntities) val = this.replaceEntitiesValue(val, tagName, jPath);
          const newval = this.options.tagValueProcessor(tagName, val, jPath, hasAttributes, isLeafNode);
          if (newval === null || newval === void 0) {
            return val;
          } else if (typeof newval !== typeof val || newval !== val) {
            return newval;
          } else if (this.options.trimValues) {
            return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
          } else {
            const trimmedVal = val.trim();
            if (trimmedVal === val) {
              return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
            } else {
              return val;
            }
          }
        }
      }
    }
    function resolveNameSpace(tagname) {
      if (this.options.removeNSPrefix) {
        const tags = tagname.split(":");
        const prefix = tagname.charAt(0) === "/" ? "/" : "";
        if (tags[0] === "xmlns") {
          return "";
        }
        if (tags.length === 2) {
          tagname = prefix + tags[1];
        }
      }
      return tagname;
    }
    var attrsRegx = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])([\\s\\S]*?)\\3)?`, "gm");
    function buildAttributesMap(attrStr, jPath, tagName) {
      if (this.options.ignoreAttributes !== true && typeof attrStr === "string") {
        const matches = util.getAllMatches(attrStr, attrsRegx);
        const len = matches.length;
        const attrs = {};
        for (let i = 0; i < len; i++) {
          const attrName = this.resolveNameSpace(matches[i][1]);
          if (this.ignoreAttributesFn(attrName, jPath)) {
            continue;
          }
          let oldVal = matches[i][4];
          let aName = this.options.attributeNamePrefix + attrName;
          if (attrName.length) {
            if (this.options.transformAttributeName) {
              aName = this.options.transformAttributeName(aName);
            }
            aName = sanitizeName(aName, this.options);
            if (oldVal !== void 0) {
              if (this.options.trimValues) {
                oldVal = oldVal.trim();
              }
              oldVal = this.replaceEntitiesValue(oldVal, tagName, jPath);
              const newVal = this.options.attributeValueProcessor(attrName, oldVal, jPath);
              if (newVal === null || newVal === void 0) {
                attrs[aName] = oldVal;
              } else if (typeof newVal !== typeof oldVal || newVal !== oldVal) {
                attrs[aName] = newVal;
              } else {
                attrs[aName] = parseValue(
                  oldVal,
                  this.options.parseAttributeValue,
                  this.options.numberParseOptions
                );
              }
            } else if (this.options.allowBooleanAttributes) {
              attrs[aName] = true;
            }
          }
        }
        if (!Object.keys(attrs).length) {
          return;
        }
        if (this.options.attributesGroupName) {
          const attrCollection = {};
          attrCollection[this.options.attributesGroupName] = attrs;
          return attrCollection;
        }
        return attrs;
      }
    }
    var parseXml = function(xmlData) {
      xmlData = xmlData.replace(/\r\n?/g, "\n");
      const xmlObj = new xmlNode("!xml");
      let currentNode = xmlObj;
      let textData = "";
      let jPath = "";
      this.entityExpansionCount = 0;
      this.currentExpandedLength = 0;
      const docTypeReader = new DocTypeReader(this.options.processEntities);
      for (let i = 0; i < xmlData.length; i++) {
        const ch = xmlData[i];
        if (ch === "<") {
          if (xmlData[i + 1] === "/") {
            const closeIndex = findClosingIndex(xmlData, ">", i, "Closing Tag is not closed.");
            let tagName = xmlData.substring(i + 2, closeIndex).trim();
            if (this.options.removeNSPrefix) {
              const colonIndex = tagName.indexOf(":");
              if (colonIndex !== -1) {
                tagName = tagName.substr(colonIndex + 1);
              }
            }
            if (this.options.transformTagName) {
              tagName = this.options.transformTagName(tagName);
            }
            if (currentNode) {
              textData = this.saveTextToParentTag(textData, currentNode, jPath);
            }
            const lastTagName = jPath.substring(jPath.lastIndexOf(".") + 1);
            if (tagName && this.options.unpairedTags.indexOf(tagName) !== -1) {
              throw new Error(`Unpaired tag can not be used as closing tag: </${tagName}>`);
            }
            let propIndex = 0;
            if (lastTagName && this.options.unpairedTags.indexOf(lastTagName) !== -1) {
              propIndex = jPath.lastIndexOf(".", jPath.lastIndexOf(".") - 1);
              this.tagsNodeStack.pop();
            } else {
              propIndex = jPath.lastIndexOf(".");
            }
            jPath = jPath.substring(0, propIndex);
            currentNode = this.tagsNodeStack.pop();
            textData = "";
            i = closeIndex;
          } else if (xmlData[i + 1] === "?") {
            let tagData = readTagExp(xmlData, i, false, "?>");
            if (!tagData) throw new Error("Pi Tag is not closed.");
            textData = this.saveTextToParentTag(textData, currentNode, jPath);
            if (this.options.ignoreDeclaration && tagData.tagName === "?xml" || this.options.ignorePiTags) {
            } else {
              const childNode = new xmlNode(tagData.tagName);
              childNode.add(this.options.textNodeName, "");
              if (tagData.tagName !== tagData.tagExp && tagData.attrExpPresent) {
                childNode[":@"] = this.buildAttributesMap(tagData.tagExp, jPath, tagData.tagName);
              }
              this.addChild(currentNode, childNode, jPath, i);
            }
            i = tagData.closeIndex + 1;
          } else if (xmlData.substr(i + 1, 3) === "!--") {
            const endIndex = findClosingIndex(xmlData, "-->", i + 4, "Comment is not closed.");
            if (this.options.commentPropName) {
              const comment = xmlData.substring(i + 4, endIndex - 2);
              textData = this.saveTextToParentTag(textData, currentNode, jPath);
              currentNode.add(this.options.commentPropName, [{ [this.options.textNodeName]: comment }]);
            }
            i = endIndex;
          } else if (xmlData.substr(i + 1, 2) === "!D") {
            const result = docTypeReader.readDocType(xmlData, i);
            this.docTypeEntities = result.entities;
            i = result.i;
          } else if (xmlData.substr(i + 1, 2) === "![") {
            const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
            const tagExp = xmlData.substring(i + 9, closeIndex);
            textData = this.saveTextToParentTag(textData, currentNode, jPath);
            let val = this.parseTextData(tagExp, currentNode.tagname, jPath, true, false, true, true);
            if (val == void 0) val = "";
            if (this.options.cdataPropName) {
              currentNode.add(this.options.cdataPropName, [{ [this.options.textNodeName]: tagExp }]);
            } else {
              currentNode.add(this.options.textNodeName, val);
            }
            i = closeIndex + 2;
          } else {
            let result = readTagExp(xmlData, i, this.options.removeNSPrefix);
            let tagName = result.tagName;
            const rawTagName = result.rawTagName;
            let tagExp = result.tagExp;
            let attrExpPresent = result.attrExpPresent;
            let closeIndex = result.closeIndex;
            if (this.options.transformTagName) {
              const newTagName = this.options.transformTagName(tagName);
              if (tagExp === tagName) {
                tagExp = newTagName;
              }
              tagName = newTagName;
            }
            if (this.options.strictReservedNames && (tagName === this.options.commentPropName || tagName === this.options.cdataPropName || tagName === this.options.textNodeName || tagName === this.options.attributesGroupName)) {
              throw new Error(`Invalid tag name: ${tagName}`);
            }
            if (currentNode && textData) {
              if (currentNode.tagname !== "!xml") {
                textData = this.saveTextToParentTag(textData, currentNode, jPath, false);
              }
            }
            const lastTag = currentNode;
            if (lastTag && this.options.unpairedTags.indexOf(lastTag.tagname) !== -1) {
              currentNode = this.tagsNodeStack.pop();
              jPath = jPath.substring(0, jPath.lastIndexOf("."));
            }
            if (tagName !== xmlObj.tagname) {
              jPath += jPath ? "." + tagName : tagName;
            }
            const startIndex = i;
            if (this.isItStopNode(this.stopNodesExact, this.stopNodesWildcard, jPath, tagName)) {
              let tagContent = "";
              if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
                if (tagName[tagName.length - 1] === "/") {
                  tagName = tagName.substr(0, tagName.length - 1);
                  jPath = jPath.substr(0, jPath.length - 1);
                  tagExp = tagName;
                } else {
                  tagExp = tagExp.substr(0, tagExp.length - 1);
                }
                i = result.closeIndex;
              } else if (this.options.unpairedTags.indexOf(tagName) !== -1) {
                i = result.closeIndex;
              } else {
                const result2 = this.readStopNodeData(xmlData, rawTagName, closeIndex + 1);
                if (!result2) throw new Error(`Unexpected end of ${rawTagName}`);
                i = result2.i;
                tagContent = result2.tagContent;
              }
              const childNode = new xmlNode(tagName);
              if (tagName !== tagExp && attrExpPresent) {
                childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
              }
              if (tagContent) {
                tagContent = this.parseTextData(tagContent, tagName, jPath, true, attrExpPresent, true, true);
              }
              jPath = jPath.substr(0, jPath.lastIndexOf("."));
              childNode.add(this.options.textNodeName, tagContent);
              this.addChild(currentNode, childNode, jPath, startIndex);
            } else {
              if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
                if (tagName[tagName.length - 1] === "/") {
                  tagName = tagName.substr(0, tagName.length - 1);
                  jPath = jPath.substr(0, jPath.length - 1);
                  tagExp = tagName;
                } else {
                  tagExp = tagExp.substr(0, tagExp.length - 1);
                }
                if (this.options.transformTagName) {
                  const newTagName = this.options.transformTagName(tagName);
                  if (tagExp === tagName) {
                    tagExp = newTagName;
                  }
                  tagName = newTagName;
                }
                const childNode = new xmlNode(tagName);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
                }
                this.addChild(currentNode, childNode, jPath, startIndex);
                jPath = jPath.substr(0, jPath.lastIndexOf("."));
              } else if (this.options.unpairedTags.indexOf(tagName) !== -1) {
                const childNode = new xmlNode(tagName);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath);
                }
                this.addChild(currentNode, childNode, jPath, startIndex);
                jPath = jPath.substr(0, jPath.lastIndexOf("."));
                i = result.closeIndex;
                continue;
              } else {
                const childNode = new xmlNode(tagName);
                if (this.tagsNodeStack.length > this.options.maxNestedTags) {
                  throw new Error("Maximum nested tags exceeded");
                }
                this.tagsNodeStack.push(currentNode);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
                }
                this.addChild(currentNode, childNode, jPath);
                currentNode = childNode;
              }
              textData = "";
              i = closeIndex;
            }
          }
        } else {
          textData += xmlData[i];
        }
      }
      return xmlObj.child;
    };
    function addChild(currentNode, childNode, jPath, startIndex) {
      if (!this.options.captureMetaData) startIndex = void 0;
      const result = this.options.updateTag(childNode.tagname, jPath, childNode[":@"]);
      if (result === false) {
      } else if (typeof result === "string") {
        childNode.tagname = result;
        currentNode.addChild(childNode, startIndex);
      } else {
        currentNode.addChild(childNode, startIndex);
      }
    }
    var replaceEntitiesValue = function(val, tagName, jPath) {
      if (val.indexOf("&") === -1) {
        return val;
      }
      const entityConfig = this.options.processEntities;
      if (!entityConfig.enabled) {
        return val;
      }
      if (entityConfig.allowedTags) {
        if (!entityConfig.allowedTags.includes(tagName)) {
          return val;
        }
      }
      if (entityConfig.tagFilter) {
        if (!entityConfig.tagFilter(tagName, jPath)) {
          return val;
        }
      }
      for (let entityName in this.docTypeEntities) {
        const entity = this.docTypeEntities[entityName];
        const matches = val.match(entity.regx);
        if (matches) {
          this.entityExpansionCount += matches.length;
          if (entityConfig.maxTotalExpansions && this.entityExpansionCount > entityConfig.maxTotalExpansions) {
            throw new Error(
              `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
            );
          }
          const lengthBefore = val.length;
          val = val.replace(entity.regx, entity.val);
          if (entityConfig.maxExpandedLength) {
            this.currentExpandedLength += val.length - lengthBefore;
            if (this.currentExpandedLength > entityConfig.maxExpandedLength) {
              throw new Error(
                `Total expanded content size exceeded: ${this.currentExpandedLength} > ${entityConfig.maxExpandedLength}`
              );
            }
          }
        }
      }
      if (val.indexOf("&") === -1) return val;
      for (const entityName of Object.keys(this.lastEntities)) {
        const entity = this.lastEntities[entityName];
        const matches = val.match(entity.regex);
        if (matches) {
          this.entityExpansionCount += matches.length;
          if (entityConfig.maxTotalExpansions && this.entityExpansionCount > entityConfig.maxTotalExpansions) {
            throw new Error(
              `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
            );
          }
        }
        val = val.replace(entity.regex, entity.val);
      }
      if (val.indexOf("&") === -1) return val;
      if (this.options.htmlEntities) {
        for (const entityName of Object.keys(this.htmlEntities)) {
          const entity = this.htmlEntities[entityName];
          const matches = val.match(entity.regex);
          if (matches) {
            this.entityExpansionCount += matches.length;
            if (entityConfig.maxTotalExpansions && this.entityExpansionCount > entityConfig.maxTotalExpansions) {
              throw new Error(
                `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
              );
            }
          }
          val = val.replace(entity.regex, entity.val);
        }
      }
      val = val.replace(this.ampEntity.regex, this.ampEntity.val);
      return val;
    };
    function saveTextToParentTag(textData, parentNode, jPath, isLeafNode) {
      if (textData) {
        if (isLeafNode === void 0) isLeafNode = parentNode.child.length === 0;
        textData = this.parseTextData(
          textData,
          parentNode.tagname,
          jPath,
          false,
          parentNode[":@"] ? Object.keys(parentNode[":@"]).length !== 0 : false,
          isLeafNode
        );
        if (textData !== void 0 && textData !== "")
          parentNode.add(this.options.textNodeName, textData);
        textData = "";
      }
      return textData;
    }
    function isItStopNode(stopNodesExact, stopNodesWildcard, jPath, currentTagName) {
      if (stopNodesWildcard && stopNodesWildcard.has(currentTagName)) return true;
      if (stopNodesExact && stopNodesExact.has(jPath)) return true;
      return false;
    }
    function tagExpWithClosingIndex(xmlData, i, closingChar = ">") {
      let attrBoundary;
      let tagExp = "";
      for (let index = i; index < xmlData.length; index++) {
        let ch = xmlData[index];
        if (attrBoundary) {
          if (ch === attrBoundary) attrBoundary = "";
        } else if (ch === '"' || ch === "'") {
          attrBoundary = ch;
        } else if (ch === closingChar[0]) {
          if (closingChar[1]) {
            if (xmlData[index + 1] === closingChar[1]) {
              return {
                data: tagExp,
                index
              };
            }
          } else {
            return {
              data: tagExp,
              index
            };
          }
        } else if (ch === "	") {
          ch = " ";
        }
        tagExp += ch;
      }
    }
    function findClosingIndex(xmlData, str, i, errMsg) {
      const closingIndex = xmlData.indexOf(str, i);
      if (closingIndex === -1) {
        throw new Error(errMsg);
      } else {
        return closingIndex + str.length - 1;
      }
    }
    function readTagExp(xmlData, i, removeNSPrefix, closingChar = ">") {
      const result = tagExpWithClosingIndex(xmlData, i + 1, closingChar);
      if (!result) return;
      let tagExp = result.data;
      const closeIndex = result.index;
      const separatorIndex = tagExp.search(/\s/);
      let tagName = tagExp;
      let attrExpPresent = true;
      if (separatorIndex !== -1) {
        tagName = tagExp.substring(0, separatorIndex);
        tagExp = tagExp.substring(separatorIndex + 1).trimStart();
      }
      const rawTagName = tagName;
      if (removeNSPrefix) {
        const colonIndex = tagName.indexOf(":");
        if (colonIndex !== -1) {
          tagName = tagName.substr(colonIndex + 1);
          attrExpPresent = tagName !== result.data.substr(colonIndex + 1);
        }
      }
      return {
        tagName,
        tagExp,
        closeIndex,
        attrExpPresent,
        rawTagName
      };
    }
    function readStopNodeData(xmlData, tagName, i) {
      const startIndex = i;
      let openTagCount = 1;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === "<") {
          if (xmlData[i + 1] === "/") {
            const closeIndex = findClosingIndex(xmlData, ">", i, `${tagName} is not closed`);
            let closeTagName = xmlData.substring(i + 2, closeIndex).trim();
            if (closeTagName === tagName) {
              openTagCount--;
              if (openTagCount === 0) {
                return {
                  tagContent: xmlData.substring(startIndex, i),
                  i: closeIndex
                };
              }
            }
            i = closeIndex;
          } else if (xmlData[i + 1] === "?") {
            const closeIndex = findClosingIndex(xmlData, "?>", i + 1, "StopNode is not closed.");
            i = closeIndex;
          } else if (xmlData.substr(i + 1, 3) === "!--") {
            const closeIndex = findClosingIndex(xmlData, "-->", i + 3, "StopNode is not closed.");
            i = closeIndex;
          } else if (xmlData.substr(i + 1, 2) === "![") {
            const closeIndex = findClosingIndex(xmlData, "]]>", i, "StopNode is not closed.") - 2;
            i = closeIndex;
          } else {
            const tagData = readTagExp(xmlData, i, ">");
            if (tagData) {
              const openTagName = tagData && tagData.tagName;
              if (openTagName === tagName && tagData.tagExp[tagData.tagExp.length - 1] !== "/") {
                openTagCount++;
              }
              i = tagData.closeIndex;
            }
          }
        }
      }
    }
    function parseValue(val, shouldParse, options) {
      if (shouldParse && typeof val === "string") {
        const newval = val.trim();
        if (newval === "true") return true;
        else if (newval === "false") return false;
        else return toNumber(val, options);
      } else {
        if (util.isExist(val)) {
          return val;
        } else {
          return "";
        }
      }
    }
    function fromCodePoint(str, base, prefix) {
      const codePoint = Number.parseInt(str, base);
      if (codePoint >= 0 && codePoint <= 1114111) {
        return String.fromCodePoint(codePoint);
      } else {
        return prefix + str + ";";
      }
    }
    function sanitizeName(name2, options) {
      if (util.criticalProperties.includes(name2)) {
        throw new Error(`[SECURITY] Invalid name: "${name2}" is a reserved JavaScript keyword that could cause prototype pollution`);
      } else if (util.DANGEROUS_PROPERTY_NAMES.includes(name2)) {
        return options.onDangerousProperty(name2);
      }
      return name2;
    }
    module.exports = OrderedObjParser;
  }
});

// node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlparser/node2json.js
var require_node2json = __commonJS({
  "node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlparser/node2json.js"(exports) {
    "use strict";
    function prettify(node, options) {
      return compress(node, options);
    }
    function compress(arr, options, jPath) {
      let text;
      const compressedObj = {};
      for (let i = 0; i < arr.length; i++) {
        const tagObj = arr[i];
        const property = propName(tagObj);
        let newJpath = "";
        if (jPath === void 0) newJpath = property;
        else newJpath = jPath + "." + property;
        if (property === options.textNodeName) {
          if (text === void 0) text = tagObj[property];
          else text += "" + tagObj[property];
        } else if (property === void 0) {
          continue;
        } else if (tagObj[property]) {
          let val = compress(tagObj[property], options, newJpath);
          const isLeaf = isLeafTag(val, options);
          if (tagObj[":@"]) {
            assignAttributes(val, tagObj[":@"], newJpath, options);
          } else if (Object.keys(val).length === 1 && val[options.textNodeName] !== void 0 && !options.alwaysCreateTextNode) {
            val = val[options.textNodeName];
          } else if (Object.keys(val).length === 0) {
            if (options.alwaysCreateTextNode) val[options.textNodeName] = "";
            else val = "";
          }
          if (compressedObj[property] !== void 0 && compressedObj.hasOwnProperty(property)) {
            if (!Array.isArray(compressedObj[property])) {
              compressedObj[property] = [compressedObj[property]];
            }
            compressedObj[property].push(val);
          } else {
            if (options.isArray(property, newJpath, isLeaf)) {
              compressedObj[property] = [val];
            } else {
              compressedObj[property] = val;
            }
          }
        }
      }
      if (typeof text === "string") {
        if (text.length > 0) compressedObj[options.textNodeName] = text;
      } else if (text !== void 0) compressedObj[options.textNodeName] = text;
      return compressedObj;
    }
    function propName(obj) {
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key !== ":@") return key;
      }
    }
    function assignAttributes(obj, attrMap, jpath, options) {
      if (attrMap) {
        const keys = Object.keys(attrMap);
        const len = keys.length;
        for (let i = 0; i < len; i++) {
          const atrrName = keys[i];
          if (options.isArray(atrrName, jpath + "." + atrrName, true, true)) {
            obj[atrrName] = [attrMap[atrrName]];
          } else {
            obj[atrrName] = attrMap[atrrName];
          }
        }
      }
    }
    function isLeafTag(obj, options) {
      const { textNodeName } = options;
      const propCount = Object.keys(obj).length;
      if (propCount === 0) {
        return true;
      }
      if (propCount === 1 && (obj[textNodeName] || typeof obj[textNodeName] === "boolean" || obj[textNodeName] === 0)) {
        return true;
      }
      return false;
    }
    exports.prettify = prettify;
  }
});

// node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlparser/XMLParser.js
var require_XMLParser = __commonJS({
  "node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlparser/XMLParser.js"(exports, module) {
    var { buildOptions } = require_OptionsBuilder();
    var OrderedObjParser = require_OrderedObjParser();
    var { prettify } = require_node2json();
    var validator = require_validator();
    var XMLParser2 = class {
      constructor(options) {
        this.externalEntities = {};
        this.options = buildOptions(options);
      }
      /**
       * Parse XML dats to JS object 
       * @param {string|Buffer} xmlData 
       * @param {boolean|Object} validationOption 
       */
      parse(xmlData, validationOption) {
        if (typeof xmlData === "string") {
        } else if (xmlData.toString) {
          xmlData = xmlData.toString();
        } else {
          throw new Error("XML data is accepted in String or Bytes[] form.");
        }
        if (validationOption) {
          if (validationOption === true) validationOption = {};
          const result = validator.validate(xmlData, validationOption);
          if (result !== true) {
            throw Error(`${result.err.msg}:${result.err.line}:${result.err.col}`);
          }
        }
        const orderedObjParser = new OrderedObjParser(this.options);
        orderedObjParser.addExternalEntities(this.externalEntities);
        const orderedResult = orderedObjParser.parseXml(xmlData);
        if (this.options.preserveOrder || orderedResult === void 0) return orderedResult;
        else return prettify(orderedResult, this.options);
      }
      /**
       * Add Entity which is not by default supported by this library
       * @param {string} key 
       * @param {string} value 
       */
      addEntity(key, value) {
        if (value.indexOf("&") !== -1) {
          throw new Error("Entity value can't have '&'");
        } else if (key.indexOf("&") !== -1 || key.indexOf(";") !== -1) {
          throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
        } else if (value === "&") {
          throw new Error("An entity with value '&' is not permitted");
        } else {
          this.externalEntities[key] = value;
        }
      }
    };
    module.exports = XMLParser2;
  }
});

// node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js
var require_orderedJs2Xml = __commonJS({
  "node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js"(exports, module) {
    var EOL = "\n";
    function toXml(jArray, options) {
      let indentation = "";
      if (options.format && options.indentBy.length > 0) {
        indentation = EOL;
      }
      return arrToStr(jArray, options, "", indentation);
    }
    function arrToStr(arr, options, jPath, indentation) {
      let xmlStr = "";
      let isPreviousElementTag = false;
      if (!Array.isArray(arr)) {
        if (arr !== void 0 && arr !== null) {
          let text = arr.toString();
          text = replaceEntitiesValue(text, options);
          return text;
        }
        return "";
      }
      for (let i = 0; i < arr.length; i++) {
        const tagObj = arr[i];
        const tagName = propName(tagObj);
        if (tagName === void 0) continue;
        let newJPath = "";
        if (jPath.length === 0) newJPath = tagName;
        else newJPath = `${jPath}.${tagName}`;
        if (tagName === options.textNodeName) {
          let tagText = tagObj[tagName];
          if (!isStopNode(newJPath, options)) {
            tagText = options.tagValueProcessor(tagName, tagText);
            tagText = replaceEntitiesValue(tagText, options);
          }
          if (isPreviousElementTag) {
            xmlStr += indentation;
          }
          xmlStr += tagText;
          isPreviousElementTag = false;
          continue;
        } else if (tagName === options.cdataPropName) {
          if (isPreviousElementTag) {
            xmlStr += indentation;
          }
          const cdataVal = String(tagObj[tagName][0][options.textNodeName]).replace(/\]\]>/g, "]]]]><![CDATA[>");
          xmlStr += `<![CDATA[${cdataVal}]]>`;
          isPreviousElementTag = false;
          continue;
        } else if (tagName === options.commentPropName) {
          const commentVal = String(tagObj[tagName][0][options.textNodeName]).replace(/--/g, "- -").replace(/-$/, "- ");
          xmlStr += indentation + `<!--${commentVal}-->`;
          isPreviousElementTag = true;
          continue;
        } else if (tagName[0] === "?") {
          const attStr2 = attr_to_str(tagObj[":@"], options);
          const tempInd = tagName === "?xml" ? "" : indentation;
          let piTextNodeName = tagObj[tagName][0][options.textNodeName];
          piTextNodeName = piTextNodeName.length !== 0 ? " " + piTextNodeName : "";
          xmlStr += tempInd + `<${tagName}${piTextNodeName}${attStr2}?>`;
          isPreviousElementTag = true;
          continue;
        }
        let newIdentation = indentation;
        if (newIdentation !== "") {
          newIdentation += options.indentBy;
        }
        const attStr = attr_to_str(tagObj[":@"], options);
        const tagStart = indentation + `<${tagName}${attStr}`;
        const tagValue = arrToStr(tagObj[tagName], options, newJPath, newIdentation);
        if (options.unpairedTags.indexOf(tagName) !== -1) {
          if (options.suppressUnpairedNode) xmlStr += tagStart + ">";
          else xmlStr += tagStart + "/>";
        } else if ((!tagValue || tagValue.length === 0) && options.suppressEmptyNode) {
          xmlStr += tagStart + "/>";
        } else if (tagValue && tagValue.endsWith(">")) {
          xmlStr += tagStart + `>${tagValue}${indentation}</${tagName}>`;
        } else {
          xmlStr += tagStart + ">";
          if (tagValue && indentation !== "" && (tagValue.includes("/>") || tagValue.includes("</"))) {
            xmlStr += indentation + options.indentBy + tagValue + indentation;
          } else {
            xmlStr += tagValue;
          }
          xmlStr += `</${tagName}>`;
        }
        isPreviousElementTag = true;
      }
      return xmlStr;
    }
    function propName(obj) {
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        if (key !== ":@") return key;
      }
    }
    function attr_to_str(attrMap, options) {
      let attrStr = "";
      if (attrMap && !options.ignoreAttributes) {
        for (let attr2 in attrMap) {
          if (!Object.prototype.hasOwnProperty.call(attrMap, attr2)) continue;
          let attrVal = options.attributeValueProcessor(attr2, attrMap[attr2]);
          attrVal = replaceEntitiesValue(attrVal, options);
          if (attrVal === true && options.suppressBooleanAttributes) {
            attrStr += ` ${attr2.substr(options.attributeNamePrefix.length)}`;
          } else {
            attrStr += ` ${attr2.substr(options.attributeNamePrefix.length)}="${attrVal}"`;
          }
        }
      }
      return attrStr;
    }
    function isStopNode(jPath, options) {
      jPath = jPath.substr(0, jPath.length - options.textNodeName.length - 1);
      let tagName = jPath.substr(jPath.lastIndexOf(".") + 1);
      for (let index in options.stopNodes) {
        if (options.stopNodes[index] === jPath || options.stopNodes[index] === "*." + tagName) return true;
      }
      return false;
    }
    function replaceEntitiesValue(textValue, options) {
      if (textValue && textValue.length > 0 && options.processEntities) {
        for (let i = 0; i < options.entities.length; i++) {
          const entity = options.entities[i];
          textValue = textValue.replace(entity.regex, entity.val);
        }
      }
      return textValue;
    }
    module.exports = toXml;
  }
});

// node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js
var require_json2xml = __commonJS({
  "node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js"(exports, module) {
    "use strict";
    var buildFromOrderedJs = require_orderedJs2Xml();
    var getIgnoreAttributesFn = require_ignoreAttributes();
    var defaultOptions = {
      attributeNamePrefix: "@_",
      attributesGroupName: false,
      textNodeName: "#text",
      ignoreAttributes: true,
      cdataPropName: false,
      format: false,
      indentBy: "  ",
      suppressEmptyNode: false,
      suppressUnpairedNode: true,
      suppressBooleanAttributes: true,
      tagValueProcessor: function(key, a) {
        return a;
      },
      attributeValueProcessor: function(attrName, a) {
        return a;
      },
      preserveOrder: false,
      commentPropName: false,
      unpairedTags: [],
      entities: [
        { regex: new RegExp("&", "g"), val: "&amp;" },
        //it must be on top
        { regex: new RegExp(">", "g"), val: "&gt;" },
        { regex: new RegExp("<", "g"), val: "&lt;" },
        { regex: new RegExp("'", "g"), val: "&apos;" },
        { regex: new RegExp('"', "g"), val: "&quot;" }
      ],
      processEntities: true,
      stopNodes: [],
      // transformTagName: false,
      // transformAttributeName: false,
      oneListGroup: false
    };
    function Builder(options) {
      this.options = Object.assign({}, defaultOptions, options);
      if (this.options.ignoreAttributes === true || this.options.attributesGroupName) {
        this.isAttribute = function() {
          return false;
        };
      } else {
        this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
        this.attrPrefixLen = this.options.attributeNamePrefix.length;
        this.isAttribute = isAttribute;
      }
      this.processTextOrObjNode = processTextOrObjNode;
      if (this.options.format) {
        this.indentate = indentate;
        this.tagEndChar = ">\n";
        this.newLine = "\n";
      } else {
        this.indentate = function() {
          return "";
        };
        this.tagEndChar = ">";
        this.newLine = "";
      }
    }
    Builder.prototype.build = function(jObj) {
      if (this.options.preserveOrder) {
        return buildFromOrderedJs(jObj, this.options);
      } else {
        if (Array.isArray(jObj) && this.options.arrayNodeName && this.options.arrayNodeName.length > 1) {
          jObj = {
            [this.options.arrayNodeName]: jObj
          };
        }
        return this.j2x(jObj, 0, []).val;
      }
    };
    Builder.prototype.j2x = function(jObj, level, ajPath) {
      let attrStr = "";
      let val = "";
      const jPath = ajPath.join(".");
      for (let key in jObj) {
        if (!Object.prototype.hasOwnProperty.call(jObj, key)) continue;
        if (typeof jObj[key] === "undefined") {
          if (this.isAttribute(key)) {
            val += "";
          }
        } else if (jObj[key] === null) {
          if (this.isAttribute(key)) {
            val += "";
          } else if (key === this.options.cdataPropName) {
            val += "";
          } else if (key[0] === "?") {
            val += this.indentate(level) + "<" + key + "?" + this.tagEndChar;
          } else {
            val += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
          }
        } else if (jObj[key] instanceof Date) {
          val += this.buildTextValNode(jObj[key], key, "", level);
        } else if (typeof jObj[key] !== "object") {
          const attr2 = this.isAttribute(key);
          if (attr2 && !this.ignoreAttributesFn(attr2, jPath)) {
            attrStr += this.buildAttrPairStr(attr2, "" + jObj[key]);
          } else if (!attr2) {
            if (key === this.options.textNodeName) {
              let newval = this.options.tagValueProcessor(key, "" + jObj[key]);
              val += this.replaceEntitiesValue(newval);
            } else {
              val += this.buildTextValNode(jObj[key], key, "", level);
            }
          }
        } else if (Array.isArray(jObj[key])) {
          const arrLen = jObj[key].length;
          let listTagVal = "";
          let listTagAttr = "";
          for (let j = 0; j < arrLen; j++) {
            const item = jObj[key][j];
            if (typeof item === "undefined") {
            } else if (item === null) {
              if (key[0] === "?") val += this.indentate(level) + "<" + key + "?" + this.tagEndChar;
              else val += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
            } else if (typeof item === "object") {
              if (this.options.oneListGroup) {
                const result = this.j2x(item, level + 1, ajPath.concat(key));
                listTagVal += result.val;
                if (this.options.attributesGroupName && item.hasOwnProperty(this.options.attributesGroupName)) {
                  listTagAttr += result.attrStr;
                }
              } else {
                listTagVal += this.processTextOrObjNode(item, key, level, ajPath);
              }
            } else {
              if (this.options.oneListGroup) {
                let textValue = this.options.tagValueProcessor(key, item);
                textValue = this.replaceEntitiesValue(textValue);
                listTagVal += textValue;
              } else {
                listTagVal += this.buildTextValNode(item, key, "", level);
              }
            }
          }
          if (this.options.oneListGroup) {
            listTagVal = this.buildObjectNode(listTagVal, key, listTagAttr, level);
          }
          val += listTagVal;
        } else {
          if (this.options.attributesGroupName && key === this.options.attributesGroupName) {
            const Ks = Object.keys(jObj[key]);
            const L = Ks.length;
            for (let j = 0; j < L; j++) {
              attrStr += this.buildAttrPairStr(Ks[j], "" + jObj[key][Ks[j]]);
            }
          } else {
            val += this.processTextOrObjNode(jObj[key], key, level, ajPath);
          }
        }
      }
      return { attrStr, val };
    };
    Builder.prototype.buildAttrPairStr = function(attrName, val) {
      val = this.options.attributeValueProcessor(attrName, "" + val);
      val = this.replaceEntitiesValue(val);
      if (this.options.suppressBooleanAttributes && val === "true") {
        return " " + attrName;
      } else return " " + attrName + '="' + val + '"';
    };
    function processTextOrObjNode(object, key, level, ajPath) {
      const result = this.j2x(object, level + 1, ajPath.concat(key));
      if (object[this.options.textNodeName] !== void 0 && Object.keys(object).length === 1) {
        return this.buildTextValNode(object[this.options.textNodeName], key, result.attrStr, level);
      } else {
        return this.buildObjectNode(result.val, key, result.attrStr, level);
      }
    }
    Builder.prototype.buildObjectNode = function(val, key, attrStr, level) {
      if (val === "") {
        if (key[0] === "?") return this.indentate(level) + "<" + key + attrStr + "?" + this.tagEndChar;
        else {
          return this.indentate(level) + "<" + key + attrStr + this.closeTag(key) + this.tagEndChar;
        }
      } else {
        let tagEndExp = "</" + key + this.tagEndChar;
        let piClosingChar = "";
        if (key[0] === "?") {
          piClosingChar = "?";
          tagEndExp = "";
        }
        if ((attrStr || attrStr === "") && val.indexOf("<") === -1) {
          return this.indentate(level) + "<" + key + attrStr + piClosingChar + ">" + val + tagEndExp;
        } else if (this.options.commentPropName !== false && key === this.options.commentPropName && piClosingChar.length === 0) {
          const safeVal = String(val).replace(/--/g, "- -").replace(/-$/, "- ");
          return this.indentate(level) + `<!--${safeVal}-->` + this.newLine;
        } else {
          return this.indentate(level) + "<" + key + attrStr + piClosingChar + this.tagEndChar + val + this.indentate(level) + tagEndExp;
        }
      }
    };
    Builder.prototype.closeTag = function(key) {
      let closeTag = "";
      if (this.options.unpairedTags.indexOf(key) !== -1) {
        if (!this.options.suppressUnpairedNode) closeTag = "/";
      } else if (this.options.suppressEmptyNode) {
        closeTag = "/";
      } else {
        closeTag = `></${key}`;
      }
      return closeTag;
    };
    Builder.prototype.buildTextValNode = function(val, key, attrStr, level) {
      if (this.options.cdataPropName !== false && key === this.options.cdataPropName) {
        const safeVal = String(val).replace(/\]\]>/g, "]]]]><![CDATA[>");
        return this.indentate(level) + `<![CDATA[${safeVal}]]>` + this.newLine;
      } else if (this.options.commentPropName !== false && key === this.options.commentPropName) {
        const safeVal = String(val).replace(/--/g, "- -").replace(/-$/, "- ");
        return this.indentate(level) + `<!--${safeVal}-->` + this.newLine;
      } else if (key[0] === "?") {
        return this.indentate(level) + "<" + key + attrStr + "?" + this.tagEndChar;
      } else {
        let textValue = this.options.tagValueProcessor(key, val);
        textValue = this.replaceEntitiesValue(textValue);
        if (textValue === "") {
          return this.indentate(level) + "<" + key + attrStr + this.closeTag(key) + this.tagEndChar;
        } else {
          return this.indentate(level) + "<" + key + attrStr + ">" + textValue + "</" + key + this.tagEndChar;
        }
      }
    };
    Builder.prototype.replaceEntitiesValue = function(textValue) {
      if (textValue && textValue.length > 0 && this.options.processEntities) {
        for (let i = 0; i < this.options.entities.length; i++) {
          const entity = this.options.entities[i];
          textValue = textValue.replace(entity.regex, entity.val);
        }
      }
      return textValue;
    };
    function indentate(level) {
      return this.options.indentBy.repeat(level);
    }
    function isAttribute(name2) {
      if (name2.startsWith(this.options.attributeNamePrefix) && name2 !== this.options.textNodeName) {
        return name2.substr(this.attrPrefixLen);
      } else {
        return false;
      }
    }
    module.exports = Builder;
  }
});

// node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/fxp.js
var require_fxp = __commonJS({
  "node_modules/.pnpm/fast-xml-parser@4.5.7/node_modules/fast-xml-parser/src/fxp.js"(exports, module) {
    "use strict";
    var validator = require_validator();
    var XMLParser2 = require_XMLParser();
    var XMLBuilder = require_json2xml();
    module.exports = {
      XMLParser: XMLParser2,
      XMLValidator: validator,
      XMLBuilder
    };
  }
});

// src/runtime/instance.ts
var InstanceRegistry = class {
  records = /* @__PURE__ */ new Map();
  seq = 0;
  /** 创建一个 starting 状态的实例（此时还没有 pid）。 */
  create(configName, configType) {
    this.seq += 1;
    const id = `${configName}#${this.seq}`;
    const snapshot = {
      id,
      configName,
      configType,
      state: "starting",
      stopPhase: "none",
      startedAt: Date.now(),
      logSources: [{ kind: "process", stream: "stdout", id: `${id}:console` }]
    };
    this.records.set(id, { snapshot });
    return snapshot;
  }
  /** 进程起来后挂上 driver，并进入 running。 */
  attach(id, driver) {
    const record = this.records.get(id);
    if (!record) return;
    record.driver = driver;
    record.snapshot.pid = driver.pid;
    record.snapshot.state = "running";
  }
  /** 启动失败：标记 failed 并记录原因。 */
  fail(id, reason) {
    const record = this.records.get(id);
    if (!record) return;
    record.reason = reason;
    record.snapshot.state = "failed";
  }
  setState(id, state, stopPhase) {
    const record = this.records.get(id);
    if (!record) return;
    record.snapshot.state = state;
    if (stopPhase) record.snapshot.stopPhase = stopPhase;
  }
  /** 进程退出：用户主动停止的一律算 stopped；否则按退出码/信号判定。 */
  applyExit(id, exit) {
    const record = this.records.get(id);
    if (!record) return;
    record.snapshot.exitCode = exit.exitCode ?? void 0;
    record.snapshot.signal = exit.signal ?? void 0;
    record.snapshot.killedBySignal = Boolean(exit.signal);
    if (record.snapshot.stopPhase !== "none") {
      record.snapshot.state = "stopped";
      return;
    }
    if (exit.signal) {
      record.snapshot.state = "stopped";
      return;
    }
    record.snapshot.state = exit.exitCode === 0 ? "stopped" : "failed";
    if (record.snapshot.state === "failed") {
      record.reason = `exit code ${exit.exitCode}`;
    }
  }
  get(id) {
    return this.records.get(id)?.snapshot;
  }
  driver(id) {
    return this.records.get(id)?.driver;
  }
  reason(id) {
    return this.records.get(id)?.reason;
  }
  list() {
    return [...this.records.values()].map((r) => ({ ...r.snapshot }));
  }
  /** 仍在跑的实例（用于卸载清理与状态聚合）。 */
  running() {
    const out = [];
    for (const [id, record] of this.records) {
      if (record.driver && (record.snapshot.state === "running" || record.snapshot.state === "stopping")) {
        out.push({ id, driver: record.driver });
      }
    }
    return out;
  }
};

// src/runtime/process.ts
function buildTerminalArgv(platform, shell, command) {
  if (platform === "windows") {
    return [shell ?? "cmd.exe", "/d", "/s", "/c", command];
  }
  return [shell ?? "/bin/bash", "-c", command];
}
var ProcessDriver = class _ProcessDriver {
  exit;
  terminated = false;
  handle;
  exited;
  // 不用 TS 参数属性：Node 的类型剥离只支持"擦除"，参数属性是语法级改写，node --test 会直接拒绝
  constructor(handle, exited) {
    this.handle = handle;
    this.exited = exited;
  }
  static async start(subprocess, options) {
    let argv;
    if (options.argv && options.argv.length > 0) {
      argv = [...options.argv];
    } else {
      const environment = await subprocess.terminalEnvironment();
      argv = buildTerminalArgv(environment.platform, environment.defaultShell, options.command ?? "");
    }
    if (argv.length === 0) throw new Error("start \u9700\u8981 command \u6216\u975E\u7A7A argv");
    const env = { ...cleanEnv(process.env), ...options.env };
    if (!env.TERM) env.TERM = "xterm-256color";
    if (subprocess.resolveExecutable && !isAbsoluteCommand(argv[0])) {
      argv[0] = await subprocess.resolveExecutable(argv[0], env);
    }
    const handle = await subprocess.spawnTerminal({
      argv,
      cwd: options.cwd,
      env,
      rows: 40,
      cols: 120,
      terminalType: "xterm-256color",
      graceMs: 3e3,
      shellActivity: options.shellActivity
    });
    const driver = new _ProcessDriver(handle, handle.done);
    handle.output.on("data", (chunk) => {
      options.onData(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    });
    void handle.done.then((exit) => {
      driver.exit = exit;
      options.onExit(exit);
    });
    return driver;
  }
  get pid() {
    return this.handle.pid;
  }
  /**
   * 两段式停止第 1 段：向前台进程组投递 SIGINT。
   * 先探测前台组是否可见：Windows 上的 PTY provider 实测 inspectForeground() 返回 processGroupId=0
   * （拿不到前台组，也拿不到 pid），此时投递是空操作，直接返回 false 让上层降级为强杀，
   * 而不是假装发了信号、再白等一个宽限期。
   */
  async softStop() {
    if (this.exit) return true;
    if (!await this.canSignalForeground()) return false;
    try {
      await this.handle.signalForeground("SIGINT");
      return true;
    } catch {
      return false;
    }
  }
  /** 前台进程组是否可定位（能定位才谈得上发信号）。 */
  async canSignalForeground() {
    if (!this.handle.inspectForeground) return false;
    try {
      const foreground = await this.handle.inspectForeground();
      return Boolean(foreground && foreground.processGroupId > 0);
    } catch {
      return false;
    }
  }
  /** 两段式停止第 2 段：terminate（幂等）。 */
  async hardStop() {
    if (this.exit || this.terminated) return;
    this.terminated = true;
    await this.handle.terminate();
  }
  /** 等进程退出；超时返回 false 而不抛错（停止流程需要区分「退了」和「没退」）。 */
  async waitExit(timeoutMs) {
    if (this.exit) return true;
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    try {
      return await Promise.race([this.exited.then(() => true), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  /** 已记录的退出事实（未退出时为 undefined）。 */
  outcome() {
    return this.exit;
  }
  async write(text) {
    await this.handle.write(text);
  }
  /** 诊断用：provider 视角下的前台进程组与活动状态 */
  async inspect() {
    const foreground = this.handle.inspectForeground ? await this.handle.inspectForeground() : void 0;
    const activity = this.handle.inspectActivity ? await this.handle.inspectActivity() : void 0;
    return { foreground, activity };
  }
};
function cleanEnv(env) {
  const out = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
function isAbsoluteCommand(command) {
  if (!command) return false;
  return /^[a-zA-Z]:[\\/]/.test(command) || command.startsWith("\\\\") || command.startsWith("/");
}

// src/runtime/log-ring.ts
var LogRing = class {
  chunks = [];
  size = 0;
  maxBytes;
  constructor(maxBytes = 2 * 1024 * 1024) {
    this.maxBytes = maxBytes;
  }
  append(text) {
    if (!text) return;
    this.chunks.push(text);
    this.size += Buffer.byteLength(text);
    while (this.size > this.maxBytes && this.chunks.length > 0) {
      const removed = this.chunks.shift();
      if (removed === void 0) break;
      this.size -= Buffer.byteLength(removed);
    }
  }
  snapshot() {
    return this.chunks.join("");
  }
  clear() {
    this.chunks = [];
    this.size = 0;
  }
};

// src/parser/extract.ts
var import_fast_xml_parser = __toESM(require_fxp(), 1);

// src/parser/before-launch.ts
var OPTION_BUILD = "Make";
var OPTION_RUN_CONFIG = "RunConfigurationTask";
var OPTION_BROWSER = "LaunchBrowser.Before.Run";
function extractBeforeLaunch(node, configName) {
  const tasks = [];
  const diagnostics = [];
  for (const method of toArray(node?.method)) {
    const options = toArray(method?.option);
    if (options.length === 0) {
      const legacyName = method?.["@_name"];
      if (typeof legacyName === "string" && legacyName.length > 0) {
        diagnostics.push(unrecognized(configName, legacyName, method));
        tasks.push({ kind: "unsupported", option: legacyName, attrs: stripCommon(method) });
      }
      continue;
    }
    for (const option of options) {
      const optionName = option?.["@_name"];
      if (typeof optionName !== "string" || optionName.length === 0) continue;
      if (option?.["@_enabled"] === "false") continue;
      const parsed = parseOption(optionName, option, configName);
      if (parsed.task) tasks.push(parsed.task);
      if (parsed.diagnostic) diagnostics.push(parsed.diagnostic);
    }
  }
  return { tasks, diagnostics };
}
function parseOption(optionName, option, configName) {
  if (optionName === OPTION_BUILD) {
    return { task: { kind: "build", option: optionName } };
  }
  if (optionName === OPTION_RUN_CONFIG) {
    const configName2 = attr(option, "run_configuration_name");
    if (!configName2) {
      return { diagnostic: malformed(configName, optionName, "run_configuration_name", option) };
    }
    return {
      task: {
        kind: "run-config",
        option: optionName,
        configName: configName2,
        configType: attr(option, "run_configuration_type"),
        target: attr(option, "run_configuration_target")
      }
    };
  }
  if (optionName === OPTION_BROWSER) {
    const url = attr(option, "url");
    if (!url) {
      return { diagnostic: malformed(configName, optionName, "url", option) };
    }
    return {
      task: {
        kind: "browser",
        option: optionName,
        url,
        browser: attr(option, "browser"),
        withDebugger: attr(option, "withDebugger") === "true"
      }
    };
  }
  return {
    task: { kind: "unsupported", option: optionName, attrs: stripCommon(option) },
    diagnostic: unrecognized(configName, optionName, option)
  };
}
function attr(node, name2) {
  const value = node?.[`@_${name2}`];
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function unrecognized(configName, optionName, node) {
  const attrs = stripCommon(node);
  const shape = Object.keys(attrs).length > 0 ? JSON.stringify(attrs) : "\uFF08\u65E0\u989D\u5916\u5C5E\u6027\uFF09";
  return {
    level: "warn",
    code: "before-launch-unrecognized",
    ref: configName,
    message: `\u672A\u8BC6\u522B\u7684 Before Launch \u4EFB\u52A1 "${optionName}"\uFF0C\u5DF2\u4FDD\u7559\u539F\u59CB\u5C5E\u6027\uFF1A${shape}\uFF1B\u9996\u7248\u4E0D\u4F1A\u6267\u884C\u5B83`
  };
}
function malformed(configName, optionName, missing, node) {
  return {
    level: "warn",
    code: "before-launch-malformed",
    ref: configName,
    message: `\u5DF2\u77E5\u4EFB\u52A1 "${optionName}" \u7F3A\u5C11\u5FC5\u9700\u5C5E\u6027 ${missing}\uFF0C\u5DF2\u8DF3\u8FC7\uFF1B\u539F\u59CB\u5C5E\u6027\uFF1A${JSON.stringify(stripCommon(node))}`
  };
}
function stripCommon(node) {
  const out = {};
  if (!node || typeof node !== "object") return out;
  for (const [key, value] of Object.entries(node)) {
    if (key === "@_name" || key === "@_enabled") continue;
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
function toArray(value) {
  if (value === void 0) return [];
  return Array.isArray(value) ? value : [value];
}

// src/parser/compound.ts
function extractCompoundRefs(node, configName = "") {
  const names = [];
  const diagnostics = [];
  const list = Array.isArray(node?.toRun) ? node.toRun : node?.toRun ? [node.toRun] : [];
  for (const item of list) {
    const name2 = item?.["@_name"];
    if (typeof name2 !== "string" || name2.length === 0) {
      diagnostics.push({
        level: "warn",
        code: "compound-missing-ref",
        ref: configName,
        message: "<toRun> \u8282\u70B9\u7F3A\u5C11 name \u5C5E\u6027\uFF0C\u5DF2\u8DF3\u8FC7\u8BE5\u5F15\u7528"
      });
      continue;
    }
    if (!names.includes(name2)) names.push(name2);
  }
  return { names, diagnostics };
}

// src/parser/modules.ts
import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

// src/parser/vars.ts
var VAR_PATTERN = /\$([A-Za-z0-9_]+)\$/g;
function substituteVars(input, ctx) {
  if (!input) return { text: "", unknown: [] };
  const userHome = ctx.userHome ?? process.env.USERPROFILE ?? process.env.HOME;
  const known = {
    PROJECT_DIR: ctx.projectRoot,
    MODULE_DIR: ctx.moduleRoot,
    USER_HOME: userHome
  };
  const unknown = [];
  const text = input.replace(VAR_PATTERN, (whole, name2) => {
    const value = known[name2];
    if (value === void 0) {
      if (!unknown.includes(name2)) unknown.push(name2);
      return whole;
    }
    return value;
  });
  return { text, unknown };
}

// src/parser/modules.ts
async function loadModuleMap(projectRoot, userHome) {
  const diagnostics = [];
  const roots = /* @__PURE__ */ new Map();
  const modulesXmlPath = join(projectRoot, ".idea", "modules.xml");
  let xml;
  try {
    xml = await readFile(modulesXmlPath, "utf8");
  } catch {
    return { roots, diagnostics };
  }
  const filepaths = [...xml.matchAll(/<module[^>]*\bfilepath="([^"]+)"[^>]*\/?>/g)].map((m) => m[1]);
  for (const raw of filepaths) {
    const substituted = substituteVars(raw, { projectRoot, userHome });
    const imlPath = substituted.text;
    const name2 = basename(imlPath).replace(/\.iml$/i, "");
    let iml;
    try {
      iml = await readFile(imlPath, "utf8");
    } catch {
      diagnostics.push({
        level: "warn",
        code: "module-unresolved",
        ref: name2,
        message: `modules.xml \u58F0\u660E\u7684 iml \u8BFB\u4E0D\u5230\uFF1A${imlPath}`
      });
      continue;
    }
    const contentUrl = [...iml.matchAll(/<content[^>]*\burl="([^"]+)"/g)].map((m) => m[1])[0];
    if (!contentUrl) {
      diagnostics.push({
        level: "warn",
        code: "module-unresolved",
        ref: name2,
        message: `iml \u6CA1\u6709 content url\uFF0C\u6A21\u5757\u6839\u672A\u77E5\uFF1A${imlPath}`
      });
      continue;
    }
    const moduleDir = dirname(imlPath);
    const moduleRoot = substituteVars(contentUrl.replace(/^file:\/\//, ""), {
      projectRoot,
      moduleRoot: moduleDir,
      userHome
    }).text;
    roots.set(name2, moduleRoot);
  }
  return { roots, diagnostics };
}
async function resolveModuleRoot(moduleName, projectRoot, known, maven) {
  const exact = known.get(moduleName);
  if (exact) return { root: exact, reason: "modules-xml" };
  const mavenHit = maven?.get(moduleName);
  if (mavenHit) return { root: mavenHit, reason: "maven-modules" };
  const candidates = await findDirsNamed(moduleName, projectRoot, 3);
  if (candidates.length === 1) return { root: candidates[0], reason: "dir-match" };
  if (candidates.length > 1) return { reason: "ambiguous", candidates };
  return { reason: "not-found" };
}
async function findDirsNamed(name2, root, maxDepth) {
  const skip = /* @__PURE__ */ new Set(["node_modules", ".git", ".idea", "target", "build", "dist", ".gradle", ".mvn"]);
  const hits = [];
  let frontier = [{ dir: root, depth: 0 }];
  while (frontier.length > 0) {
    const next = [];
    for (const { dir, depth } of frontier) {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || skip.has(entry.name)) continue;
        const child = join(dir, entry.name);
        if (entry.name === name2) {
          hits.push(child);
          continue;
        }
        if (depth + 1 < maxDepth) next.push({ dir: child, depth: depth + 1 });
      }
    }
    frontier = next;
  }
  return hits;
}

// src/parser/maven-modules.ts
import { readFile as readFile2, stat } from "node:fs/promises";
import { basename as basename2, join as join2, relative } from "node:path";
var MAX_DEPTH = 6;
async function loadMavenModules(projectRoot) {
  const byKey = /* @__PURE__ */ new Map();
  const diagnostics = [];
  const rootPom = await readPom(join2(projectRoot, "pom.xml"));
  if (!rootPom) return { byKey, diagnostics };
  const queue = [];
  for (const relPath of rootPom.modules) queue.push({ dir: join2(projectRoot, relPath), depth: 1 });
  const visited = /* @__PURE__ */ new Set();
  while (queue.length > 0 && visited.size < 500) {
    const { dir, depth } = queue.shift();
    if (depth > MAX_DEPTH || visited.has(dir)) continue;
    visited.add(dir);
    const pom = await readPom(join2(dir, "pom.xml"));
    if (!pom) {
      diagnostics.push({
        level: "warn",
        code: "module-unresolved",
        ref: relative(projectRoot, dir),
        message: `pom.xml \u7684 module \u6307\u5411\u7684\u76EE\u5F55\u6CA1\u6709 pom\uFF1A${dir}`
      });
      continue;
    }
    const relPath = relative(projectRoot, dir).replace(/\\/g, "/");
    const keys = /* @__PURE__ */ new Set();
    if (pom.artifactId) keys.add(pom.artifactId);
    keys.add(basename2(dir));
    keys.add(relPath);
    for (const key of keys) {
      if (!byKey.has(key)) byKey.set(key, dir);
    }
    for (const child of pom.modules) queue.push({ dir: join2(dir, child), depth: depth + 1 });
  }
  return { byKey, diagnostics };
}
async function readPom(path) {
  try {
    await stat(path);
  } catch {
    return null;
  }
  let text;
  try {
    text = await readFile2(path, "utf8");
  } catch {
    return null;
  }
  const withoutParent = text.replace(/<parent>[\s\S]*?<\/parent>/g, "");
  const artifactId = /<artifactId>\s*([^<]+?)\s*<\/artifactId>/.exec(withoutParent)?.[1];
  const modulesBlock = /<modules>([\s\S]*?)<\/modules>/.exec(text)?.[1] ?? "";
  const modules = [...modulesBlock.matchAll(/<module>\s*([^<]+?)\s*<\/module>/g)].map((match) => match[1]);
  return { artifactId, modules };
}

// src/parser/scan.ts
import { readdir as readdir2, readFile as readFile3 } from "node:fs/promises";
import { join as join3 } from "node:path";
async function scanSources(projectRoot) {
  const sources = [];
  sources.push(...await readXmlDir(join3(projectRoot, ".idea", "runConfigurations"), ".xml", "shared", "root"));
  sources.push(...await readXmlDir(join3(projectRoot, ".run"), ".run.xml", "shared", "root"));
  const workspace = join3(projectRoot, ".idea", "workspace.xml");
  try {
    sources.push({ path: workspace, origin: "local", selector: "run-manager", content: await readFile3(workspace, "utf8") });
  } catch {
  }
  return sources;
}
async function readXmlDir(dir, suffix, origin, selector) {
  let files;
  try {
    files = await readdir2(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const file of files) {
    if (!file.endsWith(suffix)) continue;
    const path = join3(dir, file);
    try {
      out.push({ path, origin, selector, content: await readFile3(path, "utf8") });
    } catch {
      continue;
    }
  }
  return out;
}

// src/parser/extract.ts
var parser = new import_fast_xml_parser.XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name2) => name2 === "configuration" || name2 === "option" || name2 === "env" || name2 === "toRun" || name2 === "method"
});
var TYPE_MAP = {
  SpringBootApplicationConfigurationType: "spring-boot",
  Application: "java-app",
  "js.build_tools.npm": "npm",
  CompoundRunConfigurationType: "compound"
};
async function extractConfigs(xml, source, ctx) {
  const diagnostics = [];
  let doc;
  try {
    doc = parser.parse(xml);
  } catch (error) {
    diagnostics.push({
      level: "error",
      code: "parse-error",
      ref: source.path,
      message: `XML \u89E3\u6790\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`
    });
    return { configs: [], diagnostics };
  }
  const nodes = pickConfigNodes(doc, source.selector);
  const configs = [];
  for (const node of nodes) {
    const config = await extractOne(node, source, ctx);
    if (!config) continue;
    configs.push(config);
    diagnostics.push(...config.diagnostics);
  }
  return { configs, diagnostics };
}
async function loadIdeaConfigs(projectRoot, options = {}) {
  const diagnostics = [];
  const moduleMap = await loadModuleMap(projectRoot, options.userHome);
  diagnostics.push(...moduleMap.diagnostics);
  const mavenModules = await loadMavenModules(projectRoot);
  diagnostics.push(...mavenModules.diagnostics);
  const sources = await scanSources(projectRoot);
  const ctx = {
    projectRoot,
    userHome: options.userHome,
    moduleMap: moduleMap.roots,
    moduleCache: /* @__PURE__ */ new Map(),
    mavenMap: mavenModules.byKey
  };
  const collected = [];
  for (const source of sources) {
    const result = await extractConfigs(source.content, source, ctx);
    collected.push(...result.configs);
    diagnostics.push(...result.diagnostics);
  }
  const merged = /* @__PURE__ */ new Map();
  for (const config of collected) {
    const existing = merged.get(config.name);
    if (!existing) {
      merged.set(config.name, config);
      continue;
    }
    const winner = pickOriginWinner(existing, config);
    const loser = winner === existing ? config : existing;
    merged.set(config.name, winner);
    diagnostics.push({
      level: "warn",
      code: "duplicate-config",
      ref: config.name,
      message: `\u914D\u7F6E\u91CD\u540D\uFF1A"${config.name}" \u540C\u65F6\u51FA\u73B0\u5728 ${existing.source ?? existing.origin} \u4E0E ${config.source ?? config.origin}\uFF0C\u5DF2\u91C7\u7528 ${winner.origin}\uFF0C\u5FFD\u7565 ${loser.origin}`
    });
  }
  return { configs: [...merged.values()], diagnostics };
}
async function extractOne(node, source, ctx) {
  const name2 = node?.["@_name"];
  if (typeof name2 !== "string" || name2.length === 0) return null;
  const diagnostics = [];
  const module = await resolveModuleOf(node, name2, ctx, diagnostics);
  const varContext = { projectRoot: ctx.projectRoot, moduleRoot: module.root, userHome: ctx.userHome };
  const config = buildBaseConfig(node, name2, source, module, varContext, diagnostics);
  const beforeLaunch = extractBeforeLaunch(node, name2);
  config.beforeLaunch = beforeLaunch.tasks;
  diagnostics.push(...beforeLaunch.diagnostics);
  return applyTypeFields(node, config, varContext, diagnostics);
}
async function resolveModuleOf(node, configName, ctx, diagnostics) {
  const moduleName = toArray2(node?.module)[0]?.["@_name"];
  if (typeof moduleName !== "string" || moduleName.length === 0) return {};
  let resolution = ctx.moduleCache.get(moduleName);
  if (!resolution) {
    resolution = await resolveModuleRoot(moduleName, ctx.projectRoot, ctx.moduleMap, ctx.mavenMap);
    ctx.moduleCache.set(moduleName, resolution);
  }
  if (resolution.root) {
    if (resolution.reason === "dir-match") {
      diagnostics.push({
        level: "warn",
        code: "module-unresolved",
        ref: configName,
        message: `\u6A21\u5757 "${moduleName}" \u672A\u5728 .idea/modules.xml \u4E2D\u58F0\u660E\uFF0C\u5DF2\u6309\u9879\u76EE\u5185\u540C\u540D\u76EE\u5F55\u89E3\u6790\u4E3A ${resolution.root}`
      });
    }
    return { name: moduleName, root: resolution.root };
  }
  if (resolution.reason === "ambiguous") {
    diagnostics.push({
      level: "error",
      code: "module-ambiguous",
      ref: configName,
      message: `\u6A21\u5757 "${moduleName}" \u5728\u9879\u76EE\u5185\u5339\u914D\u5230\u591A\u4E2A\u76EE\u5F55\uFF1A${(resolution.candidates ?? []).join("\u3001")}`
    });
    return { name: moduleName };
  }
  diagnostics.push({
    level: "error",
    code: "module-unresolved",
    ref: configName,
    message: `\u6A21\u5757 "${moduleName}" \u5728 .idea/modules.xml \u4E0E\u9879\u76EE\u76EE\u5F55\u4E2D\u90FD\u627E\u4E0D\u5230\uFF0C\u5DE5\u4F5C\u76EE\u5F55\u5C06\u9000\u56DE\u9879\u76EE\u6839`
  });
  return { name: moduleName };
}
function buildBaseConfig(node, name2, source, module, varContext, diagnostics) {
  const workDirRaw = getOpt(node, "WORKING_DIRECTORY") ?? "$PROJECT_DIR$";
  return {
    name: name2,
    type: TYPE_MAP[node?.["@_type"]] ?? "unsupported",
    origin: source.origin,
    source: source.path,
    factoryName: node?.["@_factoryName"],
    moduleName: module.name,
    moduleRoot: module.root,
    workDir: applyVars(workDirRaw, varContext, name2, "WORKING_DIRECTORY", diagnostics),
    env: getEnvs(node),
    beforeLaunch: [],
    diagnostics
  };
}
function applyTypeFields(node, config, varContext, diagnostics) {
  switch (config.type) {
    case "spring-boot":
    case "java-app": {
      config.mainClass = getOpt(node, config.type === "spring-boot" ? "SPRING_BOOT_MAIN_CLASS" : "MAIN_CLASS_NAME") ?? getOpt(node, "MAIN_CLASS_NAME");
      config.vmParams = getOpt(node, "VM_PARAMETERS");
      config.programParams = getOpt(node, "PROGRAM_PARAMETERS");
      return config;
    }
    case "npm": {
      const packageJsonRaw = valueOf(node?.["package-json"]) ?? "$PROJECT_DIR$/package.json";
      config.packageJson = applyVars(packageJsonRaw, varContext, config.name, "package-json", diagnostics);
      config.npmCommand = valueOf(node?.command);
      config.npmScript = valueOf(node?.scripts?.script);
      const interpreterRaw = valueOf(node?.["node-interpreter"]);
      if (interpreterRaw) {
        config.nodeInterpreter = applyVars(interpreterRaw, varContext, config.name, "node-interpreter", diagnostics);
      }
      return config;
    }
    case "compound": {
      const refs = extractCompoundRefs(node, config.name);
      config.referencedConfigs = refs.names;
      diagnostics.push(...refs.diagnostics);
      return config;
    }
    default:
      return config;
  }
}
function pickOriginWinner(a, b) {
  if (a.origin === b.origin) return a;
  return a.origin === "shared" ? a : b;
}
function pickConfigNodes(doc, selector) {
  const root = doc ?? {};
  const components = toArray2(root.component ?? root.project?.component);
  const wanted = selector === "run-manager" ? "RunManager" : "ProjectRunConfigurationManager";
  const fromWanted = components.filter((c) => c?.["@_name"] === wanted).flatMap((c) => toArray2(c?.configuration));
  if (fromWanted.length > 0) return fromWanted;
  if (selector === "root") return components.flatMap((c) => toArray2(c?.configuration));
  return [];
}
function applyVars(raw, varContext, configName, field, diagnostics) {
  const { text, unknown } = substituteVars(raw, varContext);
  for (const variable of unknown) {
    diagnostics.push({
      level: "warn",
      code: "unknown-variable",
      ref: configName,
      message: `${field} \u4E2D\u7684 $${variable}$ \u65E0\u6CD5\u89E3\u6790\uFF0C\u5DF2\u4FDD\u7559\u539F\u6587\uFF1A"${raw}"`
    });
  }
  return text;
}
function getOpt(node, name2) {
  const options = toArray2(node?.option);
  const hit = options.find((o) => o?.["@_name"] === name2);
  const value = hit?.["@_value"];
  return typeof value === "string" ? value : void 0;
}
function getEnvs(node) {
  const out = {};
  for (const env of toArray2(node?.envs?.env)) {
    const key = env?.["@_name"];
    if (typeof key === "string" && key.length > 0) out[key] = env?.["@_value"] ?? "";
  }
  return out;
}
function valueOf(node) {
  const first = Array.isArray(node) ? node[0] : node;
  const value = first?.["@_value"];
  return typeof value === "string" ? value : void 0;
}
function toArray2(value) {
  if (value === void 0) return [];
  return Array.isArray(value) ? value : [value];
}

// src/config/overlay.ts
import { readFile as readFile4, writeFile, mkdir } from "node:fs/promises";
import { dirname as dirname2, join as join4 } from "node:path";
function overlayPath(projectRoot) {
  return join4(projectRoot, ".dsh", "idea-launcher.json");
}
async function readOverlay(projectRoot) {
  const path = overlayPath(projectRoot);
  let text;
  try {
    text = await readFile4(path, "utf8");
  } catch {
    return { overlay: {}, diagnostics: [] };
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        overlay: {},
        diagnostics: [
          { level: "error", code: "overlay-invalid", ref: path, message: "\u8986\u76D6\u5C42\u5FC5\u987B\u662F\u300C\u914D\u7F6E\u540D \u2192 \u8986\u76D6\u9879\u300D\u7684\u5BF9\u8C61" }
        ]
      };
    }
    const overlay = {};
    const diagnostics = [];
    for (const [name2, value] of Object.entries(parsed)) {
      const entry = toEntry(value, name2, path, diagnostics);
      if (entry) overlay[name2] = entry;
    }
    return { overlay, diagnostics };
  } catch (error) {
    return {
      overlay: {},
      diagnostics: [
        {
          level: "error",
          code: "overlay-invalid",
          ref: path,
          message: `\u8986\u76D6\u5C42 JSON \u89E3\u6790\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}
function toEntry(value, name2, path, diagnostics) {
  if (typeof value !== "object" || value === null) {
    diagnostics.push({ level: "error", code: "overlay-invalid", ref: name2, message: `${path} \u91CC "${name2}" \u4E0D\u662F\u5BF9\u8C61` });
    return void 0;
  }
  const raw = value;
  const entry = {};
  if (typeof raw.commandOverride === "string" && raw.commandOverride.trim().length > 0) {
    entry.commandOverride = raw.commandOverride.trim();
  }
  if (typeof raw.cwdOverride === "string" && raw.cwdOverride.trim().length > 0) {
    entry.cwdOverride = raw.cwdOverride.trim();
  }
  if (raw.launchMode === "maven" || raw.launchMode === "fast") entry.launchMode = raw.launchMode;
  if (raw.env && typeof raw.env === "object") {
    const env = {};
    for (const [key, v] of Object.entries(raw.env)) {
      if (typeof v === "string") env[key] = v;
    }
    if (Object.keys(env).length > 0) entry.env = env;
  }
  return Object.keys(entry).length > 0 ? entry : void 0;
}

// src/config/project-root.ts
function resolveProjectRoot(pathValue, sessionIdValue, sessions) {
  if (pathValue && pathValue.trim().length > 0) {
    return { projectRoot: pathValue.trim(), source: "path" };
  }
  if (sessionIdValue && sessionIdValue.length > 0) {
    const session = sessions?.get(sessionIdValue);
    const cwd = session?.header?.cwd;
    if (cwd) return { projectRoot: cwd, source: "session" };
    return { error: `\u4F1A\u8BDD ${sessionIdValue} \u6CA1\u6709\u53EF\u7528\u7684 cwd\uFF08SessionHeader.cwd \u672A\u8BBE\u7F6E\uFF09` };
  }
  return { error: "\u9700\u8981 path\uFF08\u624B\u52A8\u6307\u5B9A\u9879\u76EE\u6839\uFF09\u6216 sessionId\uFF08\u8DDF\u968F\u4F1A\u8BDD cwd\uFF09" };
}

// src/mapper/java-app.ts
import { join as join6 } from "node:path";

// src/mapper/facts.ts
import { existsSync } from "node:fs";
import { join as join5 } from "node:path";
function detectPackageManager(cwd) {
  if (existsSync(join5(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join5(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}
function hasGradle(root) {
  return existsSync(join5(root, "build.gradle")) || existsSync(join5(root, "build.gradle.kts")) || existsSync(join5(root, "settings.gradle")) || existsSync(join5(root, "settings.gradle.kts"));
}
function formatCommand(argv) {
  return argv.map((part) => /[\s"']/.test(part) ? `"${part.replace(/"/g, '\\"')}"` : part).join(" ");
}
function makePlan(input) {
  const display = input.display ?? (input.argv && input.argv.length > 0 ? formatCommand(input.argv) : input.command ?? "");
  return {
    argv: input.argv,
    command: input.command,
    cwd: input.cwd,
    env: input.env ?? {},
    display,
    confidence: input.confidence,
    beforeLaunch: input.beforeLaunch ?? [],
    browserUrl: input.browserUrl,
    diagnostics: input.diagnostics ?? [],
    fastJava: input.fastJava,
    launchMode: input.launchMode
  };
}
function planDiagnostic(level, code, ref, message) {
  return { level, code, ref, message };
}

// src/mapper/java-app.ts
function mapJavaApp(cfg, projectRoot) {
  const diagnostics = [...cfg.diagnostics];
  const cwd = cfg.moduleRoot ?? cfg.workDir ?? projectRoot;
  if (!cfg.mainClass) {
    diagnostics.push(planDiagnostic("error", "command-assumption", cfg.name, "\u914D\u7F6E\u91CC\u6CA1\u6709 MAIN_CLASS_NAME\uFF0C\u65E0\u6CD5\u751F\u6210\u542F\u52A8\u547D\u4EE4"));
  }
  const argv = ["java"];
  if (cfg.vmParams?.trim()) argv.push(...cfg.vmParams.trim().split(/\s+/));
  argv.push("-cp", join6(cwd, "target", "classes"));
  if (cfg.mainClass) argv.push(cfg.mainClass);
  if (cfg.programParams?.trim()) argv.push(...cfg.programParams.trim().split(/\s+/));
  diagnostics.push(
    planDiagnostic(
      "warn",
      "command-assumption",
      cfg.name,
      "classpath \u7528 target/classes \u8FD1\u4F3C\uFF0C\u672A\u542B\u4F9D\u8D56 jar\uFF1B\u5982\u9700\u5B8C\u6574 classpath \u8BF7\u7528\u8986\u76D6\u5C42\u6539\u547D\u4EE4"
    )
  );
  return makePlan({
    argv,
    cwd,
    beforeLaunch: cfg.beforeLaunch,
    confidence: cfg.mainClass ? "low" : "low",
    diagnostics
  });
}

// src/mapper/npm.ts
import { dirname as dirname3, join as join7 } from "node:path";
function mapNpm(cfg, projectRoot) {
  const diagnostics = [...cfg.diagnostics];
  const packageJson = cfg.packageJson || join7(projectRoot, "package.json");
  const cwd = dirname3(packageJson);
  const script = cfg.npmScript;
  if (!script) {
    diagnostics.push(planDiagnostic("warn", "command-assumption", cfg.name, '\u914D\u7F6E\u91CC\u6CA1\u6709 <script>\uFF0C\u6309 "dev" \u5047\u8BBE\uFF0C\u8BF7\u5728\u8986\u76D6\u5C42\u786E\u8BA4'));
  }
  const scriptName = script ?? "dev";
  const manager = detectPackageManager(cwd);
  const argv = [manager, "run", scriptName];
  if (cfg.nodeInterpreter && /[\\/]/.test(cfg.nodeInterpreter)) {
    diagnostics.push(
      planDiagnostic(
        "warn",
        "command-assumption",
        cfg.name,
        `node-interpreter=${cfg.nodeInterpreter} \u5728 V1 \u4E0D\u53C2\u4E0E\u6267\u884C\uFF08\u4F7F\u7528\u7CFB\u7EDF node\uFF09\uFF0C\u5982\u9700\u751F\u6548\u8BF7\u7528\u8986\u76D6\u5C42\u6539\u547D\u4EE4`
      )
    );
  }
  const browser = cfg.beforeLaunch.find((t) => t.kind === "browser");
  const browserUrl = browser?.kind === "browser" ? browser.url : void 0;
  return makePlan({
    argv,
    cwd,
    beforeLaunch: cfg.beforeLaunch,
    browserUrl,
    confidence: script ? "high" : "low",
    diagnostics
  });
}

// src/mapper/spring-boot.ts
import { existsSync as existsSync2 } from "node:fs";
import { join as join8 } from "node:path";
function mapSpringBoot(cfg, projectRoot) {
  const diagnostics = [...cfg.diagnostics];
  const workdir = cfg.workDir || projectRoot;
  const vm = cfg.vmParams?.trim();
  const program = cfg.programParams?.trim();
  const browser = cfg.beforeLaunch.find((t) => t.kind === "browser");
  const browserUrl = browser?.kind === "browser" ? browser.url : void 0;
  const gradleRoot = cfg.moduleRoot ?? workdir;
  if (hasGradle(gradleRoot) || hasGradle(projectRoot)) {
    const root = hasGradle(gradleRoot) ? gradleRoot : projectRoot;
    const wrapper = join8(root, process.platform === "win32" ? "gradlew.bat" : "gradlew");
    const argv2 = [existsSync2(wrapper) ? wrapper : "gradle", "bootRun"];
    if (vm) argv2.push(`-Dorg.gradle.jvmargs=${vm}`);
    if (program) argv2.push(`--args=${program}`);
    return makePlan({ argv: argv2, cwd: root, beforeLaunch: cfg.beforeLaunch, browserUrl, confidence: "high", diagnostics });
  }
  if (cfg.moduleRoot) {
    const argv2 = ["mvn", "-Dmaven.test.skip=true", "spring-boot:run"];
    if (vm) argv2.push(`-Dspring-boot.run.jvmArguments=${vm}`);
    if (program) argv2.push(`-Dspring-boot.run.arguments=${program}`);
    const fastJava = cfg.mainClass && cfg.moduleRoot ? { moduleRoot: cfg.moduleRoot, mainClass: cfg.mainClass, vmParams: vm, programParams: program } : void 0;
    const display = fastJava ? `java ${vm ?? ""} -cp <target/classes + \u4F9D\u8D56classpath> ${cfg.mainClass} ${program ?? ""}`.replace(/\s+/g, " ").trim() : void 0;
    return makePlan({
      argv: argv2,
      cwd: cfg.moduleRoot,
      beforeLaunch: cfg.beforeLaunch,
      browserUrl,
      confidence: "high",
      diagnostics,
      fastJava,
      launchMode: fastJava ? "java" : "maven",
      display
    });
  }
  if (cfg.moduleName) {
    const argv2 = ["mvn", "-Dmaven.test.skip=true", "-pl", `:${cfg.moduleName}`, "spring-boot:run"];
    if (vm) argv2.push(`-Dspring-boot.run.jvmArguments=${vm}`);
    if (program) argv2.push(`-Dspring-boot.run.arguments=${program}`);
    diagnostics.push(
      planDiagnostic(
        "warn",
        "command-assumption",
        cfg.name,
        `\u6A21\u5757\u6839\u672A\u89E3\u6790\uFF0C\u547D\u4EE4\u6309 "-pl ${cfg.moduleName}" \u63A8\u51FA\uFF1A${formatCommand(argv2)}\uFF1B\u82E5\u6784\u5EFA\u5931\u8D25\uFF0C\u8BF7\u5728 .dsh/idea-launcher.json \u91CC\u7528 commandOverride \u4FEE\u6B63`
      )
    );
    return makePlan({ argv: argv2, cwd: workdir, beforeLaunch: cfg.beforeLaunch, browserUrl, confidence: "low", diagnostics });
  }
  const argv = ["mvn", "-Dmaven.test.skip=true", "spring-boot:run"];
  if (vm) argv.push(`-Dspring-boot.run.jvmArguments=${vm}`);
  if (program) argv.push(`-Dspring-boot.run.arguments=${program}`);
  return makePlan({ argv, cwd: workdir, beforeLaunch: cfg.beforeLaunch, browserUrl, confidence: "high", diagnostics });
}

// src/mapper/index.ts
function mapToLaunchPlan(cfg, projectRoot, overlay) {
  const base = mapByType(cfg, projectRoot);
  if (!base) return null;
  const entry = overlay?.[cfg.name];
  return entry ? applyOverlay(base, cfg.name, entry) : base;
}
function mapByType(cfg, projectRoot) {
  switch (cfg.type) {
    case "spring-boot":
      return mapSpringBoot(cfg, projectRoot);
    case "java-app":
      return mapJavaApp(cfg, projectRoot);
    case "npm":
      return mapNpm(cfg, projectRoot);
    default:
      return null;
  }
}
function applyOverlay(plan, configName, entry) {
  const next = { ...plan };
  if (entry.env) next.env = { ...next.env, ...entry.env };
  if (entry.launchMode === "maven") {
    next.fastJava = void 0;
    next.launchMode = "maven";
  }
  if (entry.launchMode === "fast" && next.fastJava) next.launchMode = "java";
  if (entry.cwdOverride) next.cwd = entry.cwdOverride;
  if (entry.commandOverride) {
    next.command = entry.commandOverride;
    next.argv = void 0;
    next.display = entry.commandOverride;
    next.confidence = "high";
    next.diagnostics = [
      ...next.diagnostics,
      planDiagnostic("warn", "command-assumption", configName, `\u547D\u4EE4\u6765\u81EA\u8986\u76D6\u5C42\uFF1A${entry.commandOverride}`)
    ];
  }
  return next;
}

// src/runtime/fast-java.ts
import { mkdir as mkdir2, readFile as readFile5, readdir as readdir3, stat as stat2, writeFile as writeFile2 } from "node:fs/promises";
import { dirname as dirname4, join as join9, sep } from "node:path";
var CACHE_DIR = [".dsh", "idea-launcher"];
var CLASSES_DIR = ["target", "classes"];
function buildJavaArgv(spec, classpath) {
  const argv = ["java"];
  const vm = spec.vmParams?.trim();
  if (vm) argv.push(...vm.split(/\s+/));
  const entries = [join9(spec.moduleRoot, ...CLASSES_DIR), classpath].filter((part) => part.length > 0);
  argv.push("-cp", entries.join(sep === "\\" ? ";" : ":"));
  argv.push(spec.mainClass);
  const program = spec.programParams?.trim();
  if (program) argv.push(...program.split(/\s+/));
  return argv;
}
function normalizeClasspath(raw) {
  return raw.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0).join(sep === "\\" ? ";" : ":");
}
function needsCompile(newestSourceAt, compiledAt) {
  if (compiledAt <= 0) return true;
  return newestSourceAt > compiledAt;
}
function classpathStale(newestPomAt, classpathAt) {
  if (classpathAt <= 0) return true;
  return newestPomAt > classpathAt;
}
function classpathCachePath(projectRoot, moduleRoot) {
  const hash = simpleHash(moduleRoot);
  return join9(projectRoot, ...CACHE_DIR, `classpath-${hash}.txt`);
}
function launcherStatePath(projectRoot) {
  return join9(projectRoot, ...CACHE_DIR, "state.json");
}
function classpathBuildArgv(spec, classpathPath) {
  return [
    "mvn",
    "-q",
    "-Dmaven.test.skip=true",
    "-DincludeScope=runtime",
    "dependency:build-classpath",
    `-Dmdep.outputFile=${classpathPath}`
  ];
}
function compileArgv() {
  return ["mvn", "-q", "-Dmaven.test.skip=true", "compile"];
}
async function readState(statePath) {
  try {
    const parsed = JSON.parse(await readFile5(statePath, "utf8"));
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
async function writeState(statePath, state) {
  await mkdir2(dirname4(statePath), { recursive: true });
  await writeFile2(statePath, `${JSON.stringify(state, null, 2)}
`, "utf8");
}
async function newestUnder(root, filter, maxDepth = 8) {
  let newest = 0;
  const walk = async (dir, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir3(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "target" || entry.name === ".git" || entry.name === "node_modules") continue;
      const full = join9(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
        continue;
      }
      if (!filter(entry.name)) continue;
      try {
        const info = await stat2(full);
        if (info.mtimeMs > newest) newest = info.mtimeMs;
      } catch {
      }
    }
  };
  await walk(root, 0);
  return newest;
}
async function inspectFastJava(spec) {
  const classpathPath = classpathCachePath(spec.projectRoot, spec.moduleRoot);
  const statePath = launcherStatePath(spec.projectRoot);
  const state = await readState(statePath);
  const record = state[spec.moduleRoot] ?? { classpathAt: 0, compiledAt: 0 };
  const notes = [];
  let classpathAt = record.classpathAt;
  let classpathExists = true;
  try {
    await stat2(classpathPath);
  } catch {
    classpathExists = false;
  }
  const newestPomAt = await newestUnder(spec.projectRoot, (name2) => name2 === "pom.xml", 3);
  const needsClasspathRebuild = !classpathExists || classpathStale(newestPomAt, classpathAt);
  if (needsClasspathRebuild) notes.push(classpathExists ? "pom \u6709\u66F4\u65B0\uFF0C\u91CD\u5EFA\u4F9D\u8D56 classpath" : "\u9996\u6B21\u542F\u52A8\uFF0C\u751F\u6210\u4F9D\u8D56 classpath");
  const sourceRoots = [
    { dir: join9(spec.moduleRoot, "src", "main", "java"), filter: (name2) => name2.endsWith(".java") },
    { dir: join9(spec.moduleRoot, "src", "main", "resources"), filter: () => true },
    ...(spec.extraSourceDirs ?? []).map((dir) => ({ dir: join9(spec.moduleRoot, dir), filter: (name2) => name2.endsWith(".java") }))
  ];
  let newestSourceAt = 0;
  for (const root of sourceRoots) {
    const at = await newestUnder(root.dir, root.filter);
    if (at > newestSourceAt) newestSourceAt = at;
  }
  const compileNeeded = spec.skipCompile ? false : spec.forceCompile || needsCompile(newestSourceAt, record.compiledAt);
  if (compileNeeded && !spec.forceCompile) notes.push("\u6E90\u7801\u6709\u66F4\u65B0\uFF0C\u5148\u7F16\u8BD1\u4E00\u6B21");
  if (spec.forceCompile) notes.push("\u6309\u8981\u6C42\u5F3A\u5236\u91CD\u65B0\u7F16\u8BD1");
  return {
    needsClasspath: needsClasspathRebuild,
    needsCompile: compileNeeded,
    classpathPath,
    statePath,
    notes
  };
}
async function stampFastJava(spec, patch) {
  const statePath = launcherStatePath(spec.projectRoot);
  const state = await readState(statePath);
  const current = state[spec.moduleRoot] ?? { classpathAt: 0, compiledAt: 0 };
  state[spec.moduleRoot] = {
    classpathAt: patch.classpathAt ?? current.classpathAt,
    compiledAt: patch.compiledAt ?? current.compiledAt
  };
  await writeState(statePath, state);
}
async function readClasspath(path) {
  return normalizeClasspath(await readFile5(path, "utf8"));
}
function simpleHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = hash * 31 + input.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(36);
}

// src/index.ts
var name = "dsh-idea-launcher";
var version = "0.2.0";
var inject = ["webServer"];
var ROUTE_PREFIX = "/idea-launcher/api";
var LOG_LIMIT_BYTES = 2 * 1024 * 1024;
var STOP_GRACE_MS = 5e3;
var MAX_BODY_BYTES = 1024 * 1024;
function apply(ctx) {
  const startedAt = Date.now();
  const registry = new InstanceRegistry();
  const logs = /* @__PURE__ */ new Map();
  const lifecycle = [];
  const pushEvent = (kind, id, detail) => {
    lifecycle.push({ at: Date.now(), kind, id, detail });
    if (lifecycle.length > 200) lifecycle.shift();
  };
  const subprocess = ctx.get?.("subprocess");
  const sessions = ctx.get?.("sessions");
  const route = {
    kind: "prefix",
    path: ROUTE_PREFIX,
    handler: async (req, res) => {
      const url = new URL(req.url ?? "/", "http://dsh.internal");
      const method = url.pathname.startsWith(`${ROUTE_PREFIX}/`) ? url.pathname.slice(ROUTE_PREFIX.length + 1) : void 0;
      try {
        await dispatch(req, res, method, url);
      } catch (error) {
        fail(res, 500, "internal-error", error instanceof Error ? error.message : String(error));
      }
    }
  };
  async function dispatch(req, res, method, url) {
    if (req.method === "GET" && method === "ping") {
      ok(res, { ok: true, name, version, hostPid: process.pid, pluginStartedAt: startedAt, now: Date.now() });
      return;
    }
    if (req.method === "GET" && method === "runtime") {
      const environment = subprocess ? await subprocess.terminalEnvironment() : void 0;
      const liveSessions = safeListSessions(sessions);
      ok(res, {
        ok: true,
        available: Boolean(subprocess),
        platform: environment?.platform ?? process.platform,
        defaultShell: environment?.defaultShell,
        stopGraceMs: STOP_GRACE_MS,
        sessionsAvailable: Boolean(sessions),
        sessions: liveSessions.slice(0, 10)
      });
      return;
    }
    if (req.method === "GET" && method === "events") {
      const since = Number(url.searchParams.get("since") ?? "0");
      const from = Number.isFinite(since) && since > 0 ? Math.min(since, lifecycle.length) : 0;
      ok(res, {
        ok: true,
        pluginStartedAt: startedAt,
        uptimeMs: Date.now() - startedAt,
        total: lifecycle.length,
        events: lifecycle.slice(from)
      });
      return;
    }
    if (req.method === "GET" && method === "instances") {
      ok(res, { ok: true, instances: registry.list() });
      return;
    }
    if (req.method === "GET" && method === "logs") {
      const id = url.searchParams.get("id") ?? "";
      const ring = logs.get(id);
      if (!ring) {
        fail(res, 404, "not-found", `unknown instance "${id}"`);
        return;
      }
      const since = Number(url.searchParams.get("since") ?? "0");
      const text = ring.snapshot();
      const offset = Number.isFinite(since) && since > 0 ? Math.min(since, text.length) : 0;
      ok(res, { ok: true, id, text: text.slice(offset), offset: text.length });
      return;
    }
    if (req.method === "GET" && method === "configs") {
      await handleConfigs(res, url);
      return;
    }
    if (req.method === "POST" && method === "run") {
      await handleRun(req, res);
      return;
    }
    if (req.method === "GET" && method === "inspect") {
      const id = url.searchParams.get("id") ?? "";
      const driver = registry.driver(id);
      if (!driver) {
        fail(res, 404, "not-found", `unknown instance "${id}"`);
        return;
      }
      ok(res, { ok: true, inspect: await driver.inspect() });
      return;
    }
    if (req.method === "POST" && method === "stop") {
      await handleStop(req, res);
      return;
    }
    if (req.method === "POST" && method === "stop-all") {
      const running = registry.running();
      for (const entry of running) {
        pushEvent("stop-request", entry.id, "all");
        registry.setState(entry.id, "stopping", "hard-killed");
        await entry.driver.hardStop();
        await entry.driver.waitExit(2e3);
        registry.setState(entry.id, "stopped", "hard-killed");
      }
      ok(res, { ok: true, stopped: running.length, instances: registry.list() });
      return;
    }
    if (req.method === "POST" && method === "clear") {
      const body = await readJson(req);
      const id = typeof body.id === "string" ? body.id : "";
      const ring = logs.get(id);
      if (!ring) {
        fail(res, 404, "not-found", `unknown instance "${id}"`);
        return;
      }
      ring.clear();
      pushEvent("clear-log", id);
      ok(res, { ok: true });
      return;
    }
    if (req.method === "POST" && method === "write") {
      const body = await readJson(req);
      const id = typeof body.id === "string" ? body.id : "";
      const data = typeof body.data === "string" ? body.data : "";
      const driver = registry.driver(id);
      if (!driver) {
        fail(res, 404, "not-found", `unknown instance "${id}"`);
        return;
      }
      await driver.write(data);
      ok(res, { ok: true });
      return;
    }
    if (method === void 0) {
      fail(res, 404, "not-found", "missing method");
      return;
    }
    fail(res, req.method === "GET" || req.method === "POST" ? 404 : 405, "not-found", `unknown method "${method}"`);
  }
  async function handleConfigs(res, url) {
    const resolved = resolveProjectRoot(url.searchParams.get("path"), url.searchParams.get("sessionId"), sessions);
    if ("error" in resolved) {
      fail(res, 400, "bad-request", resolved.error);
      return;
    }
    const projectRoot = resolved.projectRoot;
    const parsed = await loadIdeaConfigs(projectRoot);
    const { overlay, diagnostics: overlayDiagnostics } = await readOverlay(projectRoot);
    const configs = parsed.configs.map((config) => ({
      name: config.name,
      type: config.type,
      origin: config.origin,
      moduleName: config.moduleName,
      moduleRoot: config.moduleRoot,
      plan: mapToLaunchPlan(config, projectRoot, overlay)
    }));
    ok(res, {
      ok: true,
      projectRoot,
      rootSource: resolved.source,
      configs,
      diagnostics: [...parsed.diagnostics, ...overlayDiagnostics]
    });
  }
  async function handleRun(req, res) {
    if (!subprocess) {
      fail(res, 503, "no-subprocess", "ctx.subprocess \u4E0D\u53EF\u7528\uFF1A\u5F53\u524D Host \u7EC4\u5408\u6CA1\u6709\u5B89\u88C5 subprocess provider");
      return;
    }
    const body = await readJson(req);
    let launch;
    try {
      launch = await resolveLaunch(body);
    } catch (error) {
      fail(res, 400, "bad-request", error instanceof Error ? error.message : String(error));
      return;
    }
    const instance = registry.create(launch.configName, launch.configType);
    const ring = new LogRing(LOG_LIMIT_BYTES);
    logs.set(instance.id, ring);
    ok(res, { ok: true, instance: registry.get(instance.id), plan: launch.plan });
    void launchInstance(subprocess, registry, ring, instance.id, launch, body.shellActivity === true);
  }
  async function launchInstance(subprocess2, registry2, ring, instanceId, launch, shellActivity) {
    let argv = launch.argv;
    let command = launch.command;
    let usedFast = false;
    const fast = launch.plan?.fastJava;
    if (fast && launch.plan?.launchMode === "java" && launch.projectRoot) {
      try {
        argv = await prepareFastJava(subprocess2, ring, {
          projectRoot: launch.projectRoot,
          moduleRoot: fast.moduleRoot,
          mainClass: fast.mainClass,
          vmParams: fast.vmParams,
          programParams: fast.programParams
        });
        command = void 0;
        usedFast = true;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        ring.append(`[idea-launcher] \u5FEB\u901F\u542F\u52A8\u51C6\u5907\u5931\u8D25\uFF0C\u56DE\u9000 mvn spring-boot:run\uFF1A${reason}\r
`);
        argv = launch.plan?.argv;
        command = launch.plan?.command;
      }
    }
    const snapshot = registry2.get(instanceId);
    if (!snapshot || snapshot.state === "stopped" || snapshot.state === "failed") {
      ring.append("[idea-launcher] \u5B9E\u4F8B\u5DF2\u88AB\u505C\u6B62\uFF0C\u53D6\u6D88\u542F\u52A8\r\n");
      return;
    }
    ring.append(`[idea-launcher] \u542F\u52A8 ${argv ? argv.join(" ") : command ?? ""}\r
`);
    ring.append(`[idea-launcher] cwd ${launch.cwd}\r
`);
    if (usedFast) ring.append("[idea-launcher] \u5FEB\u901F\u542F\u52A8\uFF1A\u76F4\u63A5 java -cp\uFF08\u5DF2\u8DF3\u8FC7 Maven \u751F\u547D\u5468\u671F\uFF09\r\n");
    try {
      const driver = await ProcessDriver.start(subprocess2, {
        command,
        argv,
        cwd: launch.cwd,
        shellActivity: shellActivity || void 0,
        env: launch.env,
        onData: (chunk) => ring.append(chunk),
        onExit: (exit) => {
          registry2.applyExit(instanceId, exit);
          pushEvent(
            "exit",
            instanceId,
            `exitCode=${exit.exitCode} signal=${exit.signal ?? "null"} stopPhase=${registry2.get(instanceId)?.stopPhase ?? "none"}`
          );
          ring.append(`\r
[idea-launcher] \u8FDB\u7A0B\u9000\u51FA exitCode=${exit.exitCode} signal=${exit.signal}\r
`);
        }
      });
      registry2.attach(instanceId, driver);
      pushEvent("spawn", instanceId, `${usedFast ? "fast-java" : "maven"}: ${argv ? argv.join(" ") : command ?? ""}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      registry2.fail(instanceId, reason);
      pushEvent("spawn-failed", instanceId, reason);
      ring.append(`[idea-launcher] \u542F\u52A8\u5931\u8D25\uFF1A${reason}\r
`);
    }
  }
  async function prepareFastJava(subprocess2, ring, spec) {
    const before = await inspectFastJava(spec);
    for (const note of before.notes) ring.append(`[idea-launcher] ${note}\r
`);
    if (before.needsClasspath) {
      await runPrepareStep(
        subprocess2,
        classpathBuildArgv(spec, before.classpathPath),
        spec.moduleRoot,
        ring,
        "\u751F\u6210\u4F9D\u8D56 classpath",
        "\u4F9D\u8D56\u89E3\u6790\u5931\u8D25\u5E38\u89C1\u539F\u56E0\uFF1A\u5144\u5F1F\u6A21\u5757\u5C1A\u672A\u5B89\u88C5\uFF08\u5728\u9879\u76EE\u6839\u6267\u884C mvn -DskipTests install\uFF09\uFF0C\u6216\u79C1\u6709\u4ED3\u5E93 / settings.xml \u672A\u914D\u7F6E"
      );
      await stampFastJava(spec, { classpathAt: Date.now() });
    }
    if (before.needsCompile) {
      await runPrepareStep(subprocess2, compileArgv(), spec.moduleRoot, ring, "\u7F16\u8BD1");
      await stampFastJava(spec, { compiledAt: Date.now() });
    }
    const classpath = await readClasspath(before.classpathPath);
    return buildJavaArgv(spec, classpath);
  }
  async function runPrepareStep(subprocess2, argv, cwd, ring, label, hint) {
    ring.append(`[idea-launcher] ${label}\uFF1A${argv.join(" ")}\r
`);
    const driver = await ProcessDriver.start(subprocess2, {
      argv,
      cwd,
      onData: (chunk) => ring.append(chunk),
      onExit: () => {
      }
    });
    const exited = await driver.waitExit(6e5);
    const outcome = driver.outcome();
    if (!exited) {
      await driver.hardStop();
      throw new Error(`${label}\u8D85\u65F6\uFF0810 \u5206\u949F\uFF09`);
    }
    if (outcome && outcome.exitCode !== 0) {
      if (hint) ring.append(`[idea-launcher] \u63D0\u793A\uFF1A${hint}\r
`);
      throw new Error(`${label}\u5931\u8D25 exitCode=${outcome.exitCode}`);
    }
  }
  async function resolveLaunch(body) {
    const pathValue = typeof body.projectRoot === "string" && body.projectRoot.length > 0 ? body.projectRoot : void 0;
    const sessionIdValue = typeof body.sessionId === "string" && body.sessionId.length > 0 ? body.sessionId : void 0;
    const configName = typeof body.configName === "string" && body.configName.length > 0 ? body.configName : void 0;
    if (configName && (pathValue || sessionIdValue)) {
      const resolved = resolveProjectRoot(pathValue ?? null, sessionIdValue ?? null, sessions);
      if ("error" in resolved) throw new Error(resolved.error);
      const projectRoot = resolved.projectRoot;
      const parsed = await loadIdeaConfigs(projectRoot);
      const config = parsed.configs.find((c) => c.name === configName);
      if (!config) throw new Error(`\u9879\u76EE\u91CC\u6CA1\u6709\u540D\u4E3A "${configName}" \u7684\u8FD0\u884C\u914D\u7F6E`);
      const { overlay } = await readOverlay(projectRoot);
      const plan = mapToLaunchPlan(config, projectRoot, overlay);
      if (!plan) throw new Error(`\u914D\u7F6E "${configName}" \u662F ${config.type} \u7C7B\u578B\uFF0CM6 \u624D\u652F\u6301\u7F16\u6392`);
      return {
        argv: plan.argv,
        command: plan.command,
        cwd: plan.cwd,
        env: plan.env,
        configName: config.name,
        configType: config.type,
        plan,
        projectRoot
      };
    }
    const argv = Array.isArray(body.argv) && body.argv.every((v) => typeof v === "string") ? body.argv : void 0;
    const command = typeof body.command === "string" ? body.command.trim() : "";
    const cwd = typeof body.cwd === "string" && body.cwd.length > 0 ? body.cwd : process.cwd();
    if (!command && !argv) throw new Error("\u9700\u8981 command / argv\uFF0C\u6216 projectRoot+configName");
    const configType = typeof body.configType === "string" ? body.configType : "unsupported";
    return {
      argv,
      command: command || void 0,
      cwd,
      env: isStringRecord(body.env) ? body.env : void 0,
      configName: configName ?? argv?.[0] ?? command,
      configType
    };
  }
  async function handleStop(req, res) {
    const body = await readJson(req);
    const id = typeof body.id === "string" ? body.id : "";
    const mode = body.mode === "hard" ? "hard" : body.mode === "ctrl-c" ? "ctrl-c" : "soft";
    const driver = registry.driver(id);
    if (!driver) {
      fail(res, 404, "not-found", `unknown instance "${id}"`);
      return;
    }
    const current = registry.get(id);
    if (current && (current.state === "stopped" || current.state === "failed")) {
      ok(res, { ok: true, instance: current, phase: "already-exited" });
      return;
    }
    if (mode === "hard") {
      pushEvent("stop-request", id, "hard");
      registry.setState(id, "stopping", "hard-killed");
      await driver.hardStop();
      await driver.waitExit(2e3);
      registry.setState(id, "stopped", "hard-killed");
      ok(res, { ok: true, instance: registry.get(id), phase: "hard-killed" });
      return;
    }
    registry.setState(id, "stopping", "soft-killed");
    pushEvent("stop-request", id, mode === "ctrl-c" ? "ctrl-c" : "soft");
    const signalled = mode === "ctrl-c" ? await writeCtrlC(driver) : await driver.softStop();
    if (!signalled) {
      await driver.hardStop();
      registry.setState(id, "stopped", "hard-killed");
      ok(res, { ok: true, instance: registry.get(id), phase: "hard-killed", degraded: "signal-unsupported" });
      return;
    }
    const exited = await driver.waitExit(STOP_GRACE_MS);
    if (!exited) {
      await driver.hardStop();
      registry.setState(id, "stopped", "hard-killed");
      ok(res, { ok: true, instance: registry.get(id), phase: "hard-killed", degraded: "grace-expired" });
      return;
    }
    ok(res, { ok: true, instance: registry.get(id), phase: "soft-killed" });
  }
  ctx.effect(() => {
    const disposeRoute = ctx.webServer.register(route);
    return () => {
      disposeRoute();
      const running = registry.running();
      pushEvent("plugin-unload", void 0, `terminate ${running.length} running instance(s)`);
      for (const { driver } of running) void driver.hardStop();
    };
  }, "dsh-idea-launcher: /idea-launcher/api routes");
}
function safeListSessions(sessions) {
  if (!sessions?.list) return [];
  try {
    return sessions.list().map((session) => ({ id: String(session.id), cwd: session.header?.cwd }));
  } catch {
    return [];
  }
}
function ok(res, body) {
  writeJson(res, 200, body);
}
function fail(res, status, code, message) {
  writeJson(res, status, { ok: false, error: { code, message } });
}
function writeJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
    "cache-control": "no-store"
  });
  res.end(text);
}
async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("\u8BF7\u6C42\u4F53\u8D85\u8FC7 1MB \u4E0A\u9650");
    chunks.push(buffer);
  }
  if (size === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  const parsed = JSON.parse(text);
  return typeof parsed === "object" && parsed !== null ? parsed : {};
}
function isStringRecord(value) {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value).every((v) => typeof v === "string");
}
async function writeCtrlC(driver) {
  try {
    await driver.write("");
    return true;
  } catch {
    return false;
  }
}
export {
  apply,
  inject,
  name,
  version
};
