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

// node_modules/fast-xml-parser/src/util.js
var require_util = __commonJS({
  "node_modules/fast-xml-parser/src/util.js"(exports) {
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
    exports.isName = isName;
    exports.getAllMatches = getAllMatches;
    exports.nameRegexp = nameRegexp;
  }
});

// node_modules/fast-xml-parser/src/validator.js
var require_validator = __commonJS({
  "node_modules/fast-xml-parser/src/validator.js"(exports) {
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

// node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js
var require_OptionsBuilder = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js"(exports) {
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
      tagValueProcessor: function(tagName, val2) {
        return val2;
      },
      attributeValueProcessor: function(attrName, val2) {
        return val2;
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
      }
      // skipEmptyListItem: false
    };
    var buildOptions = function(options) {
      return Object.assign({}, defaultOptions, options);
    };
    exports.buildOptions = buildOptions;
    exports.defaultOptions = defaultOptions;
  }
});

// node_modules/fast-xml-parser/src/xmlparser/xmlNode.js
var require_xmlNode = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/xmlNode.js"(exports, module) {
    "use strict";
    var XmlNode = class {
      constructor(tagname) {
        this.tagname = tagname;
        this.child = [];
        this[":@"] = {};
      }
      add(key, val2) {
        if (key === "__proto__") key = "#__proto__";
        this.child.push({ [key]: val2 });
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

// node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js
var require_DocTypeReader = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js"(exports, module) {
    var util = require_util();
    function readDocType(xmlData, i) {
      const entities = {};
      if (xmlData[i + 3] === "O" && xmlData[i + 4] === "C" && xmlData[i + 5] === "T" && xmlData[i + 6] === "Y" && xmlData[i + 7] === "P" && xmlData[i + 8] === "E") {
        i = i + 9;
        let angleBracketsCount = 1;
        let hasBody = false, comment = false;
        let exp = "";
        for (; i < xmlData.length; i++) {
          if (xmlData[i] === "<" && !comment) {
            if (hasBody && isEntity(xmlData, i)) {
              i += 7;
              [entityName, val, i] = readEntityExp(xmlData, i + 1);
              if (val.indexOf("&") === -1)
                entities[validateEntityName(entityName)] = {
                  regx: RegExp(`&${entityName};`, "g"),
                  val
                };
            } else if (hasBody && isElement(xmlData, i)) i += 8;
            else if (hasBody && isAttlist(xmlData, i)) i += 8;
            else if (hasBody && isNotation(xmlData, i)) i += 9;
            else if (isComment) comment = true;
            else throw new Error("Invalid DOCTYPE");
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
    function readEntityExp(xmlData, i) {
      let entityName2 = "";
      for (; i < xmlData.length && (xmlData[i] !== "'" && xmlData[i] !== '"'); i++) {
        entityName2 += xmlData[i];
      }
      entityName2 = entityName2.trim();
      if (entityName2.indexOf(" ") !== -1) throw new Error("External entites are not supported");
      const startChar = xmlData[i++];
      let val2 = "";
      for (; i < xmlData.length && xmlData[i] !== startChar; i++) {
        val2 += xmlData[i];
      }
      return [entityName2, val2, i];
    }
    function isComment(xmlData, i) {
      if (xmlData[i + 1] === "!" && xmlData[i + 2] === "-" && xmlData[i + 3] === "-") return true;
      return false;
    }
    function isEntity(xmlData, i) {
      if (xmlData[i + 1] === "!" && xmlData[i + 2] === "E" && xmlData[i + 3] === "N" && xmlData[i + 4] === "T" && xmlData[i + 5] === "I" && xmlData[i + 6] === "T" && xmlData[i + 7] === "Y") return true;
      return false;
    }
    function isElement(xmlData, i) {
      if (xmlData[i + 1] === "!" && xmlData[i + 2] === "E" && xmlData[i + 3] === "L" && xmlData[i + 4] === "E" && xmlData[i + 5] === "M" && xmlData[i + 6] === "E" && xmlData[i + 7] === "N" && xmlData[i + 8] === "T") return true;
      return false;
    }
    function isAttlist(xmlData, i) {
      if (xmlData[i + 1] === "!" && xmlData[i + 2] === "A" && xmlData[i + 3] === "T" && xmlData[i + 4] === "T" && xmlData[i + 5] === "L" && xmlData[i + 6] === "I" && xmlData[i + 7] === "S" && xmlData[i + 8] === "T") return true;
      return false;
    }
    function isNotation(xmlData, i) {
      if (xmlData[i + 1] === "!" && xmlData[i + 2] === "N" && xmlData[i + 3] === "O" && xmlData[i + 4] === "T" && xmlData[i + 5] === "A" && xmlData[i + 6] === "T" && xmlData[i + 7] === "I" && xmlData[i + 8] === "O" && xmlData[i + 9] === "N") return true;
      return false;
    }
    function validateEntityName(name) {
      if (util.isName(name))
        return name;
      else
        throw new Error(`Invalid entity name ${name}`);
    }
    module.exports = readDocType;
  }
});

// node_modules/strnum/strnum.js
var require_strnum = __commonJS({
  "node_modules/strnum/strnum.js"(exports, module) {
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
    function toNumber(str11, options = {}) {
      options = Object.assign({}, consider, options);
      if (!str11 || typeof str11 !== "string") return str11;
      let trimmedStr = str11.trim();
      if (options.skipLike !== void 0 && options.skipLike.test(trimmedStr)) return str11;
      else if (str11 === "0") return 0;
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
              return str11;
            }
          }
          return options.eNotation ? Number(trimmedStr) : str11;
        } else {
          return str11;
        }
      } else {
        const match = numRegex.exec(trimmedStr);
        if (match) {
          const sign = match[1];
          const leadingZeros = match[2];
          let numTrimmedByZeros = trimZeros(match[3]);
          if (!options.leadingZeros && leadingZeros.length > 0 && sign && trimmedStr[2] !== ".") return str11;
          else if (!options.leadingZeros && leadingZeros.length > 0 && !sign && trimmedStr[1] !== ".") return str11;
          else if (options.leadingZeros && leadingZeros === str11) return 0;
          else {
            const num12 = Number(trimmedStr);
            const numStr = "" + num12;
            if (numStr.search(/[eE]/) !== -1) {
              if (options.eNotation) return num12;
              else return str11;
            } else if (trimmedStr.indexOf(".") !== -1) {
              if (numStr === "0" && numTrimmedByZeros === "") return num12;
              else if (numStr === numTrimmedByZeros) return num12;
              else if (sign && numStr === "-" + numTrimmedByZeros) return num12;
              else return str11;
            }
            if (leadingZeros) {
              return numTrimmedByZeros === numStr || sign + numTrimmedByZeros === numStr ? num12 : str11;
            } else {
              return trimmedStr === numStr || trimmedStr === sign + numStr ? num12 : str11;
            }
          }
        } else {
          return str11;
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

// node_modules/fast-xml-parser/src/ignoreAttributes.js
var require_ignoreAttributes = __commonJS({
  "node_modules/fast-xml-parser/src/ignoreAttributes.js"(exports, module) {
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

// node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js
var require_OrderedObjParser = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js"(exports, module) {
    "use strict";
    var util = require_util();
    var xmlNode = require_xmlNode();
    var readDocType = require_DocTypeReader();
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
          "num_dec": { regex: /&#([0-9]{1,7});/g, val: (_, str11) => String.fromCharCode(Number.parseInt(str11, 10)) },
          "num_hex": { regex: /&#x([0-9a-fA-F]{1,6});/g, val: (_, str11) => String.fromCharCode(Number.parseInt(str11, 16)) }
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
      }
    };
    function addExternalEntities(externalEntities) {
      const entKeys = Object.keys(externalEntities);
      for (let i = 0; i < entKeys.length; i++) {
        const ent = entKeys[i];
        this.lastEntities[ent] = {
          regex: new RegExp("&" + ent + ";", "g"),
          val: externalEntities[ent]
        };
      }
    }
    function parseTextData(val2, tagName, jPath, dontTrim, hasAttributes, isLeafNode, escapeEntities) {
      if (val2 !== void 0) {
        if (this.options.trimValues && !dontTrim) {
          val2 = val2.trim();
        }
        if (val2.length > 0) {
          if (!escapeEntities) val2 = this.replaceEntitiesValue(val2);
          const newval = this.options.tagValueProcessor(tagName, val2, jPath, hasAttributes, isLeafNode);
          if (newval === null || newval === void 0) {
            return val2;
          } else if (typeof newval !== typeof val2 || newval !== val2) {
            return newval;
          } else if (this.options.trimValues) {
            return parseValue(val2, this.options.parseTagValue, this.options.numberParseOptions);
          } else {
            const trimmedVal = val2.trim();
            if (trimmedVal === val2) {
              return parseValue(val2, this.options.parseTagValue, this.options.numberParseOptions);
            } else {
              return val2;
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
            if (aName === "__proto__") aName = "#__proto__";
            if (oldVal !== void 0) {
              if (this.options.trimValues) {
                oldVal = oldVal.trim();
              }
              oldVal = this.replaceEntitiesValue(oldVal);
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
              this.addChild(currentNode, childNode, jPath);
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
            const result = readDocType(xmlData, i);
            this.docTypeEntities = result.entities;
            i = result.i;
          } else if (xmlData.substr(i + 1, 2) === "![") {
            const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
            const tagExp = xmlData.substring(i + 9, closeIndex);
            textData = this.saveTextToParentTag(textData, currentNode, jPath);
            let val2 = this.parseTextData(tagExp, currentNode.tagname, jPath, true, false, true, true);
            if (val2 == void 0) val2 = "";
            if (this.options.cdataPropName) {
              currentNode.add(this.options.cdataPropName, [{ [this.options.textNodeName]: tagExp }]);
            } else {
              currentNode.add(this.options.textNodeName, val2);
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
              tagName = this.options.transformTagName(tagName);
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
            if (this.isItStopNode(this.options.stopNodes, jPath, tagName)) {
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
              this.addChild(currentNode, childNode, jPath);
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
                  tagName = this.options.transformTagName(tagName);
                }
                const childNode = new xmlNode(tagName);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
                }
                this.addChild(currentNode, childNode, jPath);
                jPath = jPath.substr(0, jPath.lastIndexOf("."));
              } else {
                const childNode = new xmlNode(tagName);
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
    function addChild(currentNode, childNode, jPath) {
      const result = this.options.updateTag(childNode.tagname, jPath, childNode[":@"]);
      if (result === false) {
      } else if (typeof result === "string") {
        childNode.tagname = result;
        currentNode.addChild(childNode);
      } else {
        currentNode.addChild(childNode);
      }
    }
    var replaceEntitiesValue = function(val2) {
      if (this.options.processEntities) {
        for (let entityName2 in this.docTypeEntities) {
          const entity = this.docTypeEntities[entityName2];
          val2 = val2.replace(entity.regx, entity.val);
        }
        for (let entityName2 in this.lastEntities) {
          const entity = this.lastEntities[entityName2];
          val2 = val2.replace(entity.regex, entity.val);
        }
        if (this.options.htmlEntities) {
          for (let entityName2 in this.htmlEntities) {
            const entity = this.htmlEntities[entityName2];
            val2 = val2.replace(entity.regex, entity.val);
          }
        }
        val2 = val2.replace(this.ampEntity.regex, this.ampEntity.val);
      }
      return val2;
    };
    function saveTextToParentTag(textData, currentNode, jPath, isLeafNode) {
      if (textData) {
        if (isLeafNode === void 0) isLeafNode = Object.keys(currentNode.child).length === 0;
        textData = this.parseTextData(
          textData,
          currentNode.tagname,
          jPath,
          false,
          currentNode[":@"] ? Object.keys(currentNode[":@"]).length !== 0 : false,
          isLeafNode
        );
        if (textData !== void 0 && textData !== "")
          currentNode.add(this.options.textNodeName, textData);
        textData = "";
      }
      return textData;
    }
    function isItStopNode(stopNodes, jPath, currentTagName) {
      const allNodesExp = "*." + currentTagName;
      for (const stopNodePath in stopNodes) {
        const stopNodeExp = stopNodes[stopNodePath];
        if (allNodesExp === stopNodeExp || jPath === stopNodeExp) return true;
      }
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
    function findClosingIndex(xmlData, str11, i, errMsg) {
      const closingIndex = xmlData.indexOf(str11, i);
      if (closingIndex === -1) {
        throw new Error(errMsg);
      } else {
        return closingIndex + str11.length - 1;
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
    function parseValue(val2, shouldParse, options) {
      if (shouldParse && typeof val2 === "string") {
        const newval = val2.trim();
        if (newval === "true") return true;
        else if (newval === "false") return false;
        else return toNumber(val2, options);
      } else {
        if (util.isExist(val2)) {
          return val2;
        } else {
          return "";
        }
      }
    }
    module.exports = OrderedObjParser;
  }
});

// node_modules/fast-xml-parser/src/xmlparser/node2json.js
var require_node2json = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/node2json.js"(exports) {
    "use strict";
    function prettify(node, options) {
      return compress(node, options);
    }
    function compress(arr, options, jPath) {
      let text3;
      const compressedObj = {};
      for (let i = 0; i < arr.length; i++) {
        const tagObj = arr[i];
        const property = propName(tagObj);
        let newJpath = "";
        if (jPath === void 0) newJpath = property;
        else newJpath = jPath + "." + property;
        if (property === options.textNodeName) {
          if (text3 === void 0) text3 = tagObj[property];
          else text3 += "" + tagObj[property];
        } else if (property === void 0) {
          continue;
        } else if (tagObj[property]) {
          let val2 = compress(tagObj[property], options, newJpath);
          const isLeaf = isLeafTag(val2, options);
          if (tagObj[":@"]) {
            assignAttributes(val2, tagObj[":@"], newJpath, options);
          } else if (Object.keys(val2).length === 1 && val2[options.textNodeName] !== void 0 && !options.alwaysCreateTextNode) {
            val2 = val2[options.textNodeName];
          } else if (Object.keys(val2).length === 0) {
            if (options.alwaysCreateTextNode) val2[options.textNodeName] = "";
            else val2 = "";
          }
          if (compressedObj[property] !== void 0 && compressedObj.hasOwnProperty(property)) {
            if (!Array.isArray(compressedObj[property])) {
              compressedObj[property] = [compressedObj[property]];
            }
            compressedObj[property].push(val2);
          } else {
            if (options.isArray(property, newJpath, isLeaf)) {
              compressedObj[property] = [val2];
            } else {
              compressedObj[property] = val2;
            }
          }
        }
      }
      if (typeof text3 === "string") {
        if (text3.length > 0) compressedObj[options.textNodeName] = text3;
      } else if (text3 !== void 0) compressedObj[options.textNodeName] = text3;
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

// node_modules/fast-xml-parser/src/xmlparser/XMLParser.js
var require_XMLParser = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/XMLParser.js"(exports, module) {
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

// node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js
var require_orderedJs2Xml = __commonJS({
  "node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js"(exports, module) {
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
          xmlStr += `<![CDATA[${tagObj[tagName][0][options.textNodeName]}]]>`;
          isPreviousElementTag = false;
          continue;
        } else if (tagName === options.commentPropName) {
          xmlStr += indentation + `<!--${tagObj[tagName][0][options.textNodeName]}-->`;
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
        if (!obj.hasOwnProperty(key)) continue;
        if (key !== ":@") return key;
      }
    }
    function attr_to_str(attrMap, options) {
      let attrStr = "";
      if (attrMap && !options.ignoreAttributes) {
        for (let attr in attrMap) {
          if (!attrMap.hasOwnProperty(attr)) continue;
          let attrVal = options.attributeValueProcessor(attr, attrMap[attr]);
          attrVal = replaceEntitiesValue(attrVal, options);
          if (attrVal === true && options.suppressBooleanAttributes) {
            attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}`;
          } else {
            attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}="${attrVal}"`;
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

// node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js
var require_json2xml = __commonJS({
  "node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js"(exports, module) {
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
      let val2 = "";
      const jPath = ajPath.join(".");
      for (let key in jObj) {
        if (!Object.prototype.hasOwnProperty.call(jObj, key)) continue;
        if (typeof jObj[key] === "undefined") {
          if (this.isAttribute(key)) {
            val2 += "";
          }
        } else if (jObj[key] === null) {
          if (this.isAttribute(key)) {
            val2 += "";
          } else if (key[0] === "?") {
            val2 += this.indentate(level) + "<" + key + "?" + this.tagEndChar;
          } else {
            val2 += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
          }
        } else if (jObj[key] instanceof Date) {
          val2 += this.buildTextValNode(jObj[key], key, "", level);
        } else if (typeof jObj[key] !== "object") {
          const attr = this.isAttribute(key);
          if (attr && !this.ignoreAttributesFn(attr, jPath)) {
            attrStr += this.buildAttrPairStr(attr, "" + jObj[key]);
          } else if (!attr) {
            if (key === this.options.textNodeName) {
              let newval = this.options.tagValueProcessor(key, "" + jObj[key]);
              val2 += this.replaceEntitiesValue(newval);
            } else {
              val2 += this.buildTextValNode(jObj[key], key, "", level);
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
              if (key[0] === "?") val2 += this.indentate(level) + "<" + key + "?" + this.tagEndChar;
              else val2 += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
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
          val2 += listTagVal;
        } else {
          if (this.options.attributesGroupName && key === this.options.attributesGroupName) {
            const Ks = Object.keys(jObj[key]);
            const L = Ks.length;
            for (let j = 0; j < L; j++) {
              attrStr += this.buildAttrPairStr(Ks[j], "" + jObj[key][Ks[j]]);
            }
          } else {
            val2 += this.processTextOrObjNode(jObj[key], key, level, ajPath);
          }
        }
      }
      return { attrStr, val: val2 };
    };
    Builder.prototype.buildAttrPairStr = function(attrName, val2) {
      val2 = this.options.attributeValueProcessor(attrName, "" + val2);
      val2 = this.replaceEntitiesValue(val2);
      if (this.options.suppressBooleanAttributes && val2 === "true") {
        return " " + attrName;
      } else return " " + attrName + '="' + val2 + '"';
    };
    function processTextOrObjNode(object, key, level, ajPath) {
      const result = this.j2x(object, level + 1, ajPath.concat(key));
      if (object[this.options.textNodeName] !== void 0 && Object.keys(object).length === 1) {
        return this.buildTextValNode(object[this.options.textNodeName], key, result.attrStr, level);
      } else {
        return this.buildObjectNode(result.val, key, result.attrStr, level);
      }
    }
    Builder.prototype.buildObjectNode = function(val2, key, attrStr, level) {
      if (val2 === "") {
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
        if ((attrStr || attrStr === "") && val2.indexOf("<") === -1) {
          return this.indentate(level) + "<" + key + attrStr + piClosingChar + ">" + val2 + tagEndExp;
        } else if (this.options.commentPropName !== false && key === this.options.commentPropName && piClosingChar.length === 0) {
          return this.indentate(level) + `<!--${val2}-->` + this.newLine;
        } else {
          return this.indentate(level) + "<" + key + attrStr + piClosingChar + this.tagEndChar + val2 + this.indentate(level) + tagEndExp;
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
    Builder.prototype.buildTextValNode = function(val2, key, attrStr, level) {
      if (this.options.cdataPropName !== false && key === this.options.cdataPropName) {
        return this.indentate(level) + `<![CDATA[${val2}]]>` + this.newLine;
      } else if (this.options.commentPropName !== false && key === this.options.commentPropName) {
        return this.indentate(level) + `<!--${val2}-->` + this.newLine;
      } else if (key[0] === "?") {
        return this.indentate(level) + "<" + key + attrStr + "?" + this.tagEndChar;
      } else {
        let textValue = this.options.tagValueProcessor(key, val2);
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
    function isAttribute(name) {
      if (name.startsWith(this.options.attributeNamePrefix) && name !== this.options.textNodeName) {
        return name.substr(this.attrPrefixLen);
      } else {
        return false;
      }
    }
    module.exports = Builder;
  }
});

// node_modules/fast-xml-parser/src/fxp.js
var require_fxp = __commonJS({
  "node_modules/fast-xml-parser/src/fxp.js"(exports, module) {
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

// shim-blobs.mts
var MAIN = null;
var SHARDS = [];
function bindDB(db, shards) {
  MAIN = db;
  SHARDS = (shards || []).filter(Boolean);
}
var PHOTO_STORES = /* @__PURE__ */ new Set(["photos", "gphotos"]);
function hash(k) {
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) {
    h ^= k.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function dbFor(store14, key) {
  return PHOTO_STORES.has(store14) && SHARDS.length ? SHARDS[hash(key) % SHARDS.length] : MAIN;
}
var CACHE_DAYS = 14;
var PART = 1e6;
var te = new TextEncoder();
var td = new TextDecoder();
function toBytes(v) {
  if (v instanceof Uint8Array) return { bytes: v, ctype: "bin" };
  if (v instanceof ArrayBuffer) return { bytes: new Uint8Array(v), ctype: "bin" };
  if (ArrayBuffer.isView(v)) return { bytes: new Uint8Array(v.buffer, v.byteOffset, v.byteLength), ctype: "bin" };
  return { bytes: te.encode(String(v)), ctype: "text" };
}
async function readRows(db, store14, key) {
  const r = await db.prepare("SELECT part, data, meta, ctype FROM blobs WHERE store=?1 AND key=?2 ORDER BY part").bind(store14, key).all();
  return r.results || [];
}
async function readRaw(store14, key) {
  const db = dbFor(store14, key);
  let rows = await readRows(db, store14, key);
  if (!rows.length && db !== MAIN) rows = await readRows(MAIN, store14, key);
  if (!rows.length) return null;
  const chunks = rows.map((x) => x.data instanceof ArrayBuffer ? new Uint8Array(x.data) : new Uint8Array(x.data));
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const bytes = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    bytes.set(c, o);
    o += c.length;
  }
  let meta = {};
  try {
    meta = rows[0].meta ? JSON.parse(rows[0].meta) : {};
  } catch {
  }
  return { bytes, ctype: rows[0].ctype || "text", meta };
}
async function writeRaw(store14, key, bytes, ctype, meta) {
  const DB = dbFor(store14, key);
  if (DB !== MAIN) await MAIN.prepare("DELETE FROM blobs WHERE store=?1 AND key=?2").bind(store14, key).run();
  const stmts = [DB.prepare("DELETE FROM blobs WHERE store=?1 AND key=?2").bind(store14, key)];
  const metaStr = JSON.stringify(meta || {});
  const n = Math.max(1, Math.ceil(bytes.length / PART));
  for (let i = 0; i < n; i++) {
    stmts.push(DB.prepare("INSERT INTO blobs (store, key, part, data, meta, ctype, updated) VALUES (?1,?2,?3,?4,?5,?6,?7)").bind(store14, key, i, bytes.slice(i * PART, (i + 1) * PART), metaStr, ctype, Date.now()));
  }
  await DB.batch(stmts);
  if (store14 === "cache" && Math.random() < 0.02) {
    try {
      await MAIN.prepare("DELETE FROM blobs WHERE store='cache' AND updated < ?1").bind(Date.now() - CACHE_DAYS * 864e5).run();
    } catch {
    }
  }
}
function convert(raw, type) {
  if (type === "arrayBuffer") return raw.bytes.buffer.slice(raw.bytes.byteOffset, raw.bytes.byteOffset + raw.bytes.byteLength);
  if (type === "blob") return new Blob([raw.bytes]);
  if (type === "stream") return new Blob([raw.bytes]).stream();
  const text3 = td.decode(raw.bytes);
  if (type === "json") {
    try {
      return JSON.parse(text3);
    } catch {
      return null;
    }
  }
  return text3;
}
function getStore(opt) {
  const name = typeof opt === "string" ? opt : opt?.name;
  return {
    async get(key, o) {
      const raw = await readRaw(name, key);
      return raw ? convert(raw, o?.type) : null;
    },
    async getWithMetadata(key, o) {
      const raw = await readRaw(name, key);
      return raw ? { data: convert(raw, o?.type), metadata: raw.meta, etag: "" } : null;
    },
    async getMetadata(key) {
      const db = dbFor(name, key);
      let r = await db.prepare("SELECT meta FROM blobs WHERE store=?1 AND key=?2 AND part=0").bind(name, key).first();
      if (!r && db !== MAIN) r = await MAIN.prepare("SELECT meta FROM blobs WHERE store=?1 AND key=?2 AND part=0").bind(name, key).first();
      if (!r) return null;
      let metadata = {};
      try {
        metadata = JSON.parse(r.meta || "{}");
      } catch {
      }
      return { metadata, etag: "" };
    },
    async set(key, value, o) {
      if (value instanceof Blob) value = new Uint8Array(await value.arrayBuffer());
      const { bytes, ctype } = toBytes(value);
      await writeRaw(name, key, bytes, ctype, o?.metadata);
      return {};
    },
    async setJSON(key, value, o) {
      await writeRaw(name, key, te.encode(JSON.stringify(value)), "json", o?.metadata);
      return {};
    },
    async delete(key) {
      if (PHOTO_STORES.has(name) && /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(key)) {
        const tk = key.replace(/\.[a-z]+$/, "") + ".t.jpg", tdb = dbFor(name, tk);
        try {
          await tdb.prepare("DELETE FROM blobs WHERE store=?1 AND key=?2").bind(name, tk).run();
          if (tdb !== MAIN) await MAIN.prepare("DELETE FROM blobs WHERE store=?1 AND key=?2").bind(name, tk).run();
        } catch {
        }
      }
      const db = dbFor(name, key);
      await db.prepare("DELETE FROM blobs WHERE store=?1 AND key=?2").bind(name, key).run();
      if (db !== MAIN) await MAIN.prepare("DELETE FROM blobs WHERE store=?1 AND key=?2").bind(name, key).run();
    },
    async list(o) {
      const prefix = o?.prefix || "";
      const r = await MAIN.prepare("SELECT key FROM blobs WHERE store=?1 AND part=0 AND key >= ?2 AND key < ?3 ORDER BY key").bind(name, prefix, prefix + "\uFFFF").all();
      return { blobs: (r.results || []).map((x) => ({ key: x.key, etag: "" })), directories: [] };
    }
  };
}

// worker.mts
import { AsyncLocalStorage } from "node:async_hooks";

// ../src/lib/guests.mts
var store = () => getStore({ name: "guests", consistency: "strong" });
var MAX_TOKENS = 10;
var LOCK_FAILS = 5;
var LOCK_MS = 10 * 60 * 1e3;
var SEEN_EVERY_MS = 10 * 60 * 1e3;
var hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
function rand(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return hex(a.buffer);
}
async function sha256(t) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)));
}
var ITER = 1e4;
async function pbkdf2(salt, password, iterations = ITER) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations }, key, 256);
  return hex(bits);
}
var nickKeyOf = (n) => String(n || "").normalize("NFC").replace(/\s+/g, "").toLowerCase();
function cleanNick(n) {
  return typeof n === "string" ? n.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 20) : "";
}
async function readGuest(id) {
  if (!/^[0-9a-f]{16}$/.test(id)) return null;
  return await store().get("u-" + id, { type: "json" });
}
async function writeGuest(g) {
  await store().setJSON("u-" + g.id, g);
}
function publicGuest(g) {
  return { id: g.id, nickname: g.nickname, realName: g.realName || "", createdAt: g.createdAt, lastSeen: g.lastSeen, status: g.status, devices: g.tokens.length };
}
function parseCookie(req, name) {
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}
var cache = /* @__PURE__ */ new Map();
async function guestFromReq(req) {
  const raw = parseCookie(req, "gk");
  const m = /^([0-9a-f]{16})\.([0-9a-f]{48})$/.exec(raw);
  if (!m) return { guest: null, blocked: false };
  const hit = cache.get(raw);
  let g;
  if (hit && Date.now() - hit.at < 3e4) g = hit.g;
  else {
    g = await readGuest(m[1]);
    const h = await sha256("gk|" + m[2]);
    if (g && !g.tokens.some((t) => t.h === h)) g = null;
    cache.set(raw, { at: Date.now(), g });
  }
  if (!g) return { guest: null, blocked: false };
  if (g.status !== "active") return { guest: null, blocked: true };
  if (Date.now() - (g.lastSeen || 0) > SEEN_EVERY_MS) {
    g.lastSeen = Date.now();
    readGuest(g.id).then((f) => {
      if (f) {
        f.lastSeen = Date.now();
        return writeGuest(f);
      }
    }).catch(() => {
    });
  }
  return { guest: g, blocked: false };
}
async function issueToken(g, req) {
  const token = rand(24);
  g.tokens.unshift({ h: await sha256("gk|" + token), at: Date.now(), ua: (req.headers.get("user-agent") || "").slice(0, 80) });
  g.tokens = g.tokens.slice(0, MAX_TOKENS);
  return `${g.id}.${token}`;
}
async function registerGuest(nickname, password, req) {
  const nick = cleanNick(nickname);
  const key = nickKeyOf(nick);
  if (nick.length < 2) return { error: "nickname too short" };
  if (password.length < 4 || password.length > 100) return { error: "password too short" };
  if (await store().get("n-" + key, { type: "json" })) return { error: "nickname taken" };
  const salt = rand(12);
  const g = { id: rand(8), nickname: nick, nickKey: key, salt, hash: await pbkdf2(salt, password), it: ITER, tokens: [], createdAt: Date.now(), lastSeen: Date.now(), status: "active", fails: 0, lockUntil: 0 };
  const cookieValue = await issueToken(g, req);
  await writeGuest(g);
  await store().setJSON("n-" + key, { id: g.id });
  return { guest: g, cookieValue };
}
async function loginGuest(nickname, password, req) {
  const idx = await store().get("n-" + nickKeyOf(cleanNick(nickname)), { type: "json" });
  const g = idx ? await readGuest(idx.id) : null;
  if (!g) return { error: "wrong" };
  if (g.status !== "active") return { error: "blocked" };
  if (g.lockUntil > Date.now()) return { error: "locked", until: g.lockUntil };
  if (await pbkdf2(g.salt, password, g.it || 1e5) !== g.hash) {
    g.fails = (g.fails || 0) + 1;
    if (g.fails >= LOCK_FAILS) {
      g.lockUntil = Date.now() + LOCK_MS;
      g.fails = 0;
    }
    await writeGuest(g);
    return { error: "wrong" };
  }
  g.fails = 0;
  g.lockUntil = 0;
  g.lastSeen = Date.now();
  const cookieValue = await issueToken(g, req);
  await writeGuest(g);
  return { guest: g, cookieValue };
}
async function logoutGuest(req) {
  const raw = parseCookie(req, "gk");
  const m = /^([0-9a-f]{16})\.([0-9a-f]{48})$/.exec(raw);
  if (!m) return;
  const g = await readGuest(m[1]);
  if (!g) return;
  const h = await sha256("gk|" + m[2]);
  g.tokens = g.tokens.filter((t) => t.h !== h);
  await writeGuest(g);
  cache.delete(raw);
}
async function listGuests() {
  const { blobs } = await store().list({ prefix: "u-" });
  const all = (await Promise.all(blobs.map((b) => store().get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
  return all.map(publicGuest).sort((a, b) => b.lastSeen - a.lastSeen);
}
async function setGuestStatus(id, status) {
  const g = await readGuest(id);
  if (!g || status !== "active" && status !== "blocked") return null;
  g.status = status;
  if (status === "blocked") g.tokens = [];
  await writeGuest(g);
  cache.clear();
  return publicGuest(g);
}
async function setGuestRealName(id, name) {
  const g = await readGuest(id);
  if (!g) return null;
  g.realName = typeof name === "string" ? name.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 30) : "";
  await writeGuest(g);
  cache.clear();
  return publicGuest(g);
}
async function resetGuestPassword(id, password) {
  const g = await readGuest(id);
  if (!g || password.length < 4) return null;
  g.salt = rand(12);
  g.hash = await pbkdf2(g.salt, password);
  g.it = ITER;
  g.tokens = [];
  g.fails = 0;
  g.lockUntil = 0;
  await writeGuest(g);
  cache.clear();
  return publicGuest(g);
}
async function deleteGuest(id) {
  const g = await readGuest(id);
  if (!g) return false;
  await store().delete("u-" + id);
  await store().delete("n-" + g.nickKey);
  cache.clear();
  return true;
}
async function setGuestPrefs(id, prefs) {
  const g = await readGuest(id);
  if (!g) return null;
  const off = Array.isArray(prefs?.off) ? Array.from(new Set(prefs.off.filter((x) => typeof x === "string" && /^[a-z]{2,12}$/.test(x)))).slice(0, 30) : [];
  g.prefs = { off, at: Date.now() };
  await writeGuest(g);
  cache.clear();
  return g.prefs;
}

// ../src/lib/auth.mts
var KEY = "auth";
var store2 = () => getStore({ name: "settings", consistency: "strong" });
var cached = null;
var TTL_MS = 15e3;
async function readSettings(fresh = false) {
  if (!fresh && cached && cached.value && Date.now() - cached.at < TTL_MS) return cached.value;
  const v = await store2().get(KEY, { type: "json" });
  const value = v && v.editHash && v.editToken && v.viewKey && v.salt ? v : null;
  cached = { at: Date.now(), value };
  return value;
}
async function writeSettings(value) {
  await store2().setJSON(KEY, value);
  cached = { at: Date.now(), value };
}
function randomKey(bytes = 18) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(salt, password) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function cookiesOf(req) {
  const out = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
function same(a, b) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function accessOf(req, fresh = false) {
  const s = await readSettings(fresh);
  if (!s) return { configured: false, canEdit: true, canView: true, linkOk: true, needGuest: false, blocked: false, guest: null, settings: null };
  const c = cookiesOf(req);
  const canEdit = same(c.ek, s.editToken);
  const linkOk = canEdit || same(c.vk, s.viewKey);
  let guest = null, blocked = false;
  if (linkOk && !canEdit) {
    const r = await guestFromReq(req);
    guest = r.guest;
    blocked = r.blocked;
  }
  const canView = canEdit || linkOk && !!guest;
  return { configured: true, canEdit, canView, linkOk, needGuest: linkOk && !canEdit && !guest, blocked, guest, settings: s };
}
function cookie(name, value, maxAgeSec) {
  return `${name}=${value}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Lax`;
}
function deny(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
function normalizeShare(v) {
  const b = (x, d) => typeof x === "boolean" ? x : d;
  const t = v?.tabs || {};
  const ids = Array.isArray(v?.hiddenStories) ? v.hiddenStories.filter((x) => typeof x === "string" && x.length <= 80).slice(0, 5e3) : [];
  return {
    // 골프·날씨는 나중에 생긴 탭: 저장된 값이 없으면 예전처럼 골프는 "둘러보기", 날씨는 "지도" 설정을 따른다
    tabs: { feed: false, map: b(t.map, true), golf: b(t.golf, b(t.browse, true)), weather: b(t.weather, b(t.map, true)), browse: b(t.browse, true), food: b(t.food, true), camp: b(t.camp, true), gstory: b(t.gstory, true), mine: false },
    marks: b(v?.marks, true),
    storyMemo: b(v?.storyMemo, true),
    storyLocation: b(v?.storyLocation, true),
    hiddenStories: Array.from(new Set(ids)),
    guestApproval: b(v?.guestApproval, false)
  };
}
var shareCache = null;
async function readShare(fresh = false) {
  if (!fresh && shareCache && Date.now() - shareCache.at < TTL_MS) return shareCache.value;
  const v = await store2().get("share", { type: "json" });
  const value = normalizeShare(v || {});
  shareCache = { at: Date.now(), value };
  return value;
}
async function writeShare(v) {
  const value = normalizeShare(v);
  await store2().setJSON("share", value);
  shareCache = { at: Date.now(), value };
  return value;
}
async function viewerShare(req) {
  const a = await accessOf(req);
  if (!a.configured || a.canEdit) return null;
  return readShare();
}
async function guard(req, need) {
  const level = need || (req.method === "GET" || req.method === "HEAD" ? "read" : "edit");
  const a = await accessOf(req);
  if (!a.configured) return null;
  if (level === "edit") return a.canEdit ? null : deny(a.canView ? 403 : 401, "edit not allowed");
  return a.canView ? null : deny(401, a.needGuest ? a.blocked ? "guest-blocked" : "guest-login" : "link required");
}

// shim-xml2js.mts
var import_fast_xml_parser = __toESM(require_fxp(), 1);
var parser = new import_fast_xml_parser.XMLParser({ ignoreAttributes: true, trimValues: true, parseTagValue: false, ignoreDeclaration: true, ignorePiTags: true });
function fix(v) {
  if (Array.isArray(v)) return v.map(fix);
  if (v && typeof v === "object") {
    const o = {};
    for (const k in v) o[k] = fix(v[k]);
    return o;
  }
  if (v === void 0 || v === null) return "";
  return typeof v === "string" ? v : String(v);
}
async function parseStringPromise(text3, _opts) {
  return fix(parser.parse(String(text3)));
}

// ../src/lib/govApi.mts
async function parseMaybeXml(text3) {
  try {
    return JSON.parse(text3);
  } catch {
    return parseStringPromise(text3, { explicitArray: false, ignoreAttrs: true, trim: true });
  }
}
function extractItems(data) {
  const items = data?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}
function extractResultCode(data) {
  return {
    resultCode: data?.response?.header?.resultCode ?? data?.resultCode,
    resultMsg: data?.response?.header?.resultMsg ?? data?.resultMsg
  };
}
async function callGovApi(baseUrl, operation, serviceKey, params, timeoutMs = 8e3) {
  const url = new URL(`${baseUrl}/${operation}`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("MobileOS", "ETC");
  url.searchParams.set("MobileApp", "TravelStoryApp");
  url.searchParams.set("_type", "json");
  url.searchParams.set("numOfRows", "50");
  url.searchParams.set("pageNo", "1");
  for (const [key, value] of Object.entries(params)) {
    if (value === void 0 || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(timeoutMs) });
  const text3 = await res.text();
  const data = await parseMaybeXml(text3);
  const { resultCode, resultMsg } = extractResultCode(data);
  const items = extractItems(data);
  return {
    ok: resultCode === "0000" || resultCode === "00" || items.length > 0 && !resultCode,
    resultCode,
    resultMsg,
    items,
    raw: data
  };
}
function jsonResponse(body, init) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // 이 API는 claude.ai 아티팩트(다른 오리진)에서 fetch로 직접 호출하는 용도이므로
      // CORS를 명시적으로 열어줘야 함(사용자가 이 아키텍처를 명시적으로 요청함).
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      ...init?.headers || {}
    }
  });
}
function corsPreflightResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

// ../src/data/mockData.mts
var mockAttractions = [
  {
    id: "mock-attr-1",
    type: "attraction",
    name: "\uACBD\uBCF5\uAD81",
    address: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uC885\uB85C\uAD6C \uC0AC\uC9C1\uB85C 161",
    areaCode: "1",
    mapX: 126.977,
    mapY: 37.5796,
    image: null,
    tel: "02-3700-3900",
    overview: "\uC870\uC120 \uC655\uC870\uC758 \uBC95\uAD81. \uC11C\uC6B8 \uB3C4\uC2EC \uB300\uD45C \uAD00\uAD11\uC9C0 (\uC0D8\uD50C \uB370\uC774\uD130)"
  },
  {
    id: "mock-attr-2",
    type: "attraction",
    name: "N\uC11C\uC6B8\uD0C0\uC6CC",
    address: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uC6A9\uC0B0\uAD6C \uB0A8\uC0B0\uACF5\uC6D0\uAE38 105",
    areaCode: "1",
    mapX: 126.9882,
    mapY: 37.5512,
    image: null,
    tel: "02-3455-9277",
    overview: "\uB0A8\uC0B0 \uC815\uC0C1\uC758 \uC804\uB9DD \uD0C0\uC6CC (\uC0D8\uD50C \uB370\uC774\uD130)"
  },
  {
    id: "mock-food-1",
    type: "restaurant",
    name: "\uAD11\uC7A5\uC2DC\uC7A5 \uB9DB\uC9D1\uAC70\uB9AC",
    address: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uC885\uB85C\uAD6C \uCC3D\uACBD\uAD81\uB85C 88",
    areaCode: "1",
    mapX: 126.9996,
    mapY: 37.5701,
    image: null,
    tel: "02-2267-0291",
    overview: "\uBE48\uB300\uB5A1, \uB9C8\uC57D\uAE40\uBC25 \uB4F1 \uC804\uD1B5\uC2DC\uC7A5 \uBA39\uAC70\uB9AC (\uC0D8\uD50C \uB370\uC774\uD130)"
  },
  {
    id: "mock-food-2",
    type: "restaurant",
    name: "\uBA85\uB3D9\uAD50\uC790",
    address: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uC911\uAD6C \uBA85\uB3D910\uAE38 29",
    areaCode: "1",
    mapX: 126.986,
    mapY: 37.5636,
    image: null,
    tel: "02-776-5348",
    overview: "\uCE7C\uAD6D\uC218/\uB9CC\uB450 \uC804\uBB38\uC810 (\uC0D8\uD50C \uB370\uC774\uD130)"
  }
];
var mockFestivals = [
  {
    id: "mock-fest-1",
    name: "\uC11C\uC6B8\uBE5B\uCD08\uB871\uCD95\uC81C",
    place: "\uCCAD\uACC4\uCC9C \uC77C\uB300",
    startDate: "2026-11-01",
    endDate: "2026-11-23",
    organizer: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC",
    tel: "02-2290-6114",
    homepage: null,
    address: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uC885\uB85C\uAD6C \uCCAD\uACC4\uCC9C\uB85C",
    mapX: 126.991,
    mapY: 37.5695,
    overview: "\uCCAD\uACC4\uCC9C\uC744 \uB530\uB77C \uD3BC\uCCD0\uC9C0\uB294 \uB300\uD615 \uB4F1\uBD88 \uCD95\uC81C (\uC0D8\uD50C \uB370\uC774\uD130)"
  },
  {
    id: "mock-fest-2",
    name: "\uC9C4\uD574 \uAD70\uD56D\uC81C",
    place: "\uACBD\uD654\uC5ED \uC77C\uC6D0",
    startDate: "2027-03-25",
    endDate: "2027-04-03",
    organizer: "\uCC3D\uC6D0\uC2DC",
    tel: "055-225-3096",
    homepage: null,
    address: "\uACBD\uC0C1\uB0A8\uB3C4 \uCC3D\uC6D0\uC2DC \uC9C4\uD574\uAD6C",
    mapX: 128.6811,
    mapY: 35.1462,
    overview: "\uBC9A\uAF43\uACFC \uD568\uAED8\uD558\uB294 \uC804\uAD6D \uCD5C\uB300 \uADDC\uBAA8 \uBD04 \uCD95\uC81C (\uC0D8\uD50C \uB370\uC774\uD130)"
  }
];
var mockTrails = [
  {
    id: "mock-trail-1",
    name: "\uBD81\uD55C\uC0B0 \uB458\uB808\uAE38 1\uAD6C\uAC04 (\uC18C\uB098\uBB34\uC232\uAE38)",
    region: "\uC11C\uC6B8 \uAC15\uBD81\uAD6C",
    distanceKm: 2.3,
    durationMin: 60,
    difficulty: "\uC26C\uC6C0",
    startPoint: "\uC6B0\uC774\uB839 \uC785\uAD6C",
    endPoint: "\uC18C\uB098\uBB34\uC232\uAE38 \uC804\uB9DD\uB300",
    gpxUrl: null,
    overview: "\uC644\uB9CC\uD55C \uC18C\uB098\uBB34 \uC232\uAE38 \uCF54\uC2A4 (\uC0D8\uD50C \uB370\uC774\uD130)"
  },
  {
    id: "mock-trail-2",
    name: "\uD574\uD30C\uB791\uAE38 1\uCF54\uC2A4",
    region: "\uBD80\uC0B0 \uC624\uB959\uB3C4",
    distanceKm: 16.7,
    durationMin: 300,
    difficulty: "\uBCF4\uD1B5",
    startPoint: "\uC624\uB959\uB3C4 \uD574\uB9DE\uC774\uACF5\uC6D0",
    endPoint: "\uBBF8\uD3EC",
    gpxUrl: null,
    overview: "\uBD80\uC0B0\uC5D0\uC11C \uAC15\uC6D0 \uACE0\uC131\uAE4C\uC9C0 \uC774\uC5B4\uC9C0\uB294 \uD574\uD30C\uB791\uAE38\uC758 \uC2DC\uC791 \uAD6C\uAC04 (\uC0D8\uD50C \uB370\uC774\uD130)"
  }
];

// ../src/lib/places.mts
var TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorService2";
var CONTENT_TYPE = {
  attraction: "12",
  restaurant: "39"
};
function normalize(rawItem, type) {
  return {
    id: String(rawItem.contentid ?? rawItem.id),
    type,
    name: rawItem.title,
    address: rawItem.addr1 || rawItem.addr2 || "",
    areaCode: rawItem.areacode,
    mapX: Number(rawItem.mapx),
    mapY: Number(rawItem.mapy),
    image: rawItem.firstimage || null,
    tel: rawItem.tel || null,
    overview: rawItem.overview || null
  };
}
async function fetchPlaces(opts) {
  const type = opts.type === "restaurant" ? "restaurant" : "attraction";
  if (!opts.serviceKey) {
    return {
      mock: true,
      items: mockAttractions.filter((item) => item.type === type)
    };
  }
  const contentTypeId = CONTENT_TYPE[type];
  const operation = opts.mapX && opts.mapY ? "locationBasedList2" : "areaBasedList2";
  const params = opts.mapX && opts.mapY ? { contentTypeId, mapX: opts.mapX, mapY: opts.mapY, radius: opts.radius || 2e3 } : { contentTypeId, areaCode: opts.areaCode };
  const result = await callGovApi(TOUR_API_BASE, operation, opts.serviceKey, params);
  return {
    mock: false,
    resultCode: result.resultCode,
    resultMsg: result.resultMsg,
    items: result.items.map((item) => normalize(item, type))
  };
}

// ../netlify/functions/attractions.mts
var FALLBACK_KEY = "";
var attractions_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const areaCode = url.searchParams.get("areaCode") || void 0;
    const mapX = url.searchParams.get("mapX");
    const mapY = url.searchParams.get("mapY");
    const radius = url.searchParams.get("radius");
    const result = await fetchPlaces({
      type: "attraction",
      areaCode,
      mapX: mapX ? Number(mapX) : void 0,
      mapY: mapY ? Number(mapY) : void 0,
      radius: radius ? Number(radius) : void 0,
      serviceKey: Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY
    });
    return jsonResponse({ ...result, count: result.items.length });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config = {
  path: "/api/attractions"
};

// ../netlify/functions/auth.mts
var YEAR = 60 * 60 * 24 * 365;
var MIN_LEN = 6;
function reply(body, status = 200, cookies = []) {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(JSON.stringify(body), { status, headers });
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var auth_default = async (req, _context) => {
  try {
    if (req.method === "GET") {
      const a2 = await accessOf(req, true);
      const share = a2.configured ? await readShare(true) : null;
      return reply({
        configured: a2.configured,
        canEdit: a2.canEdit,
        canView: a2.canView,
        linkOk: a2.linkOk,
        needGuest: a2.needGuest,
        blocked: a2.blocked,
        guest: a2.guest ? { id: a2.guest.id, nickname: a2.guest.nickname, prefs: a2.guest.prefs || null } : null,
        shareKey: a2.configured && a2.canEdit ? a2.settings.viewKey : null,
        share
      });
    }
    if (req.method !== "POST") return reply({ error: "method not allowed" }, 405);
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const action = String(body?.action || "");
    const password = typeof body?.password === "string" ? body.password : "";
    const settings = await readSettings(true);
    if (action === "setup") {
      if (settings) return reply({ error: "already configured" }, 409);
      if (password.length < MIN_LEN) return reply({ error: "password too short", min: MIN_LEN }, 400);
      const salt = randomKey(12);
      const next = { salt, editHash: await hashPassword(salt, password), editToken: randomKey(24), viewKey: randomKey(12) };
      await writeSettings(next);
      return reply({ ok: true, canEdit: true, canView: true, configured: true, shareKey: next.viewKey }, 200, [cookie("ek", next.editToken, YEAR)]);
    }
    if (!settings) return reply({ error: "not configured" }, 409);
    if (action === "login") {
      const ok = await hashPassword(settings.salt, password) === settings.editHash;
      if (!ok) {
        await sleep(800);
        return reply({ error: "wrong password" }, 401);
      }
      return reply({ ok: true, canEdit: true, canView: true, configured: true, shareKey: settings.viewKey }, 200, [cookie("ek", settings.editToken, YEAR)]);
    }
    if (action === "view") {
      const key = typeof body?.key === "string" ? body.key : "";
      if (!key || key !== settings.viewKey) {
        await sleep(400);
        return reply({ error: "bad link" }, 401);
      }
      return reply({ ok: true, canView: true }, 200, [cookie("vk", settings.viewKey, YEAR)]);
    }
    if (action === "logout") {
      return reply({ ok: true }, 200, [cookie("ek", "", 0)]);
    }
    if (action === "gjoin" || action === "glogin") {
      const a0 = await accessOf(req, true);
      if (!a0.linkOk) return reply({ error: "link required" }, 401);
      const nickname = typeof body?.nickname === "string" ? body.nickname : "";
      const r = action === "gjoin" ? await registerGuest(nickname, password, req) : await loginGuest(nickname, password, req);
      if (r.error) {
        if (r.error === "wrong") await sleep(700);
        return reply({ error: r.error, until: r.until || null }, r.error === "nickname taken" ? 409 : /too short/.test(r.error) ? 400 : 401);
      }
      return reply({ ok: true, guest: { id: r.guest.id, nickname: r.guest.nickname } }, 200, [cookie("gk", r.cookieValue, YEAR)]);
    }
    if (action === "gprefs") {
      const a1 = await accessOf(req, true);
      if (!a1.guest) return reply({ error: "guest only" }, 401);
      return reply({ ok: true, prefs: await setGuestPrefs(a1.guest.id, body?.prefs) });
    }
    if (action === "glogout") {
      await logoutGuest(req);
      return reply({ ok: true }, 200, [cookie("gk", "", 0)]);
    }
    const a = await accessOf(req, true);
    if (!a.canEdit) return reply({ error: "edit not allowed" }, 403);
    if (action === "glist") return reply({ ok: true, guests: await listGuests() });
    if (action === "gstatus") {
      const g = await setGuestStatus(String(body?.id || ""), String(body?.status || ""));
      return g ? reply({ ok: true, guest: g }) : reply({ error: "not found" }, 404);
    }
    if (action === "gname") {
      const g = await setGuestRealName(String(body?.id || ""), body?.name);
      return g ? reply({ ok: true, guest: g }) : reply({ error: "not found" }, 404);
    }
    if (action === "greset") {
      if (password.length < 4) return reply({ error: "password too short", min: 4 }, 400);
      const g = await resetGuestPassword(String(body?.id || ""), password);
      return g ? reply({ ok: true, guest: g }) : reply({ error: "not found" }, 404);
    }
    if (action === "gdelete") return await deleteGuest(String(body?.id || "")) ? reply({ ok: true }) : reply({ error: "not found" }, 404);
    if (action === "share") {
      const share = await writeShare(body?.share);
      return reply({ ok: true, share });
    }
    if (action === "newlink") {
      const next = { ...settings, viewKey: randomKey(12) };
      await writeSettings(next);
      return reply({ ok: true, shareKey: next.viewKey });
    }
    if (action === "password") {
      if (password.length < MIN_LEN) return reply({ error: "password too short", min: MIN_LEN }, 400);
      const salt = randomKey(12);
      const next = { ...settings, salt, editHash: await hashPassword(salt, password), editToken: randomKey(24) };
      await writeSettings(next);
      return reply({ ok: true }, 200, [cookie("ek", next.editToken, YEAR)]);
    }
    return reply({ error: "unknown action" }, 400);
  } catch (err) {
    return reply({ error: err?.message || "unknown error" }, 500);
  }
};
var config2 = {
  path: "/api/auth"
};

// ../netlify/functions/customimages.mts
var KEY2 = "all";
var store3 = () => getStore({ name: "customimages", consistency: "strong" });
var photos = () => getStore({ name: "photos", consistency: "strong" });
var KEY_RE = /^[a-z]:[A-Za-z0-9_\-.:]{1,100}$/;
var PHOTO_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;
async function readAll() {
  const data = await store3().get(KEY2, { type: "json" });
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}
var customimages_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    if (req.method === "GET") {
      const items = await readAll();
      return jsonResponse({ items, count: Object.keys(items).length });
    }
    if (req.method === "PUT") {
      const body = await req.json();
      const key = typeof body?.key === "string" ? body.key : "";
      if (!KEY_RE.test(key)) return jsonResponse({ error: "bad key" }, { status: 400 });
      const photoId = typeof body?.photoId === "string" && PHOTO_RE.test(body.photoId) ? body.photoId : null;
      const url = typeof body?.url === "string" && /^https:\/\/[^\s"'<>]{4,1000}$/.test(body.url.trim()) ? body.url.trim() : null;
      if (body?.url && !photoId && !url) return jsonResponse({ error: "bad url" }, { status: 400 });
      const items = await readAll();
      const old = items[key];
      if (photoId) items[key] = { photoId };
      else if (url) items[key] = { url };
      else delete items[key];
      await store3().setJSON(KEY2, items);
      if (old?.photoId && old.photoId !== photoId) await photos().delete(old.photoId);
      return jsonResponse({ ok: true, item: items[key] || null });
    }
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config3 = {
  path: "/api/customimages"
};

// ../netlify/functions/placephotos.mts
var KEY3 = "all";
var MAX_ADD = 30;
var MAX_HIDE = 80;
var store4 = () => getStore({ name: "placephotos", consistency: "strong" });
var photos2 = () => getStore({ name: "photos", consistency: "strong" });
var KEY_RE2 = /^[a-z]:[A-Za-z0-9_\-.:]{1,100}$/;
var PHOTO_RE2 = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;
var URL_RE = /^https:\/\/[^\s"'<>]{4,1000}$/;
var HERO_RE = /^(https:\/\/[^\s"'<>]{4,1000}|\/api\/photos\/[0-9a-f-]{36}\.(jpg|png|webp|gif)|\/img\/[^\s"'<>]{1,300}|\/api\/gphotos\/[^\s"'<>]{1,300})$/;
async function readAll2() {
  const data = await store4().get(KEY3, { type: "json" });
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}
var placephotos_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    if (req.method === "GET") {
      const items = await readAll2();
      return jsonResponse({ items, count: Object.keys(items).length });
    }
    if (req.method === "PUT") {
      const body = await req.json();
      const key = typeof body?.key === "string" ? body.key : "";
      if (!KEY_RE2.test(key)) return jsonResponse({ error: "bad key" }, { status: 400 });
      const action = String(body?.action || "");
      const items = await readAll2();
      const cur = items[key] || { add: [], hide: [] };
      cur.add = Array.isArray(cur.add) ? cur.add : [];
      cur.hide = Array.isArray(cur.hide) ? cur.hide : [];
      let dropFile = "";
      if (action === "add") {
        const photoId = typeof body.photoId === "string" && PHOTO_RE2.test(body.photoId) ? body.photoId : null;
        const url = typeof body.url === "string" && URL_RE.test(body.url.trim()) ? body.url.trim() : null;
        if (!photoId && !url) return jsonResponse({ error: "bad photo" }, { status: 400 });
        if (cur.add.length >= MAX_ADD) return jsonResponse({ error: "too many photos" }, { status: 409 });
        const entry = photoId ? { photoId } : { url };
        if (typeof body.desc === "string" && body.desc.trim()) entry.desc = body.desc.trim().slice(0, 80);
        if (!cur.add.some((x) => photoId && x.photoId === photoId || url && x.url === url)) cur.add.push(entry);
        if (url) cur.hide = cur.hide.filter((h) => h !== url);
      } else if (action === "remove") {
        const photoId = typeof body.photoId === "string" ? body.photoId : "";
        const url = typeof body.url === "string" ? body.url : "";
        const before = cur.add.length;
        cur.add = cur.add.filter((x) => !(photoId && x.photoId === photoId || url && x.url === url));
        if (photoId && cur.add.length !== before && PHOTO_RE2.test(photoId)) dropFile = photoId;
        if (cur.hero && (photoId && cur.hero === "/api/photos/" + photoId || url && cur.hero === url)) delete cur.hero;
      } else if (action === "hide") {
        const url = typeof body.url === "string" ? body.url.trim() : "";
        if (!/^(https:\/\/|\/img\/|\/api\/gphotos\/)[^\s"'<>]{2,1000}$/.test(url)) return jsonResponse({ error: "bad url" }, { status: 400 });
        if (!cur.hide.includes(url)) cur.hide.push(url);
        if (cur.hero === url) delete cur.hero;
        if (cur.hide.length > MAX_HIDE) cur.hide = cur.hide.slice(-MAX_HIDE);
      } else if (action === "unhide") {
        cur.hide = [];
      } else if (action === "hero") {
        const url = typeof body.url === "string" ? body.url.trim() : "";
        if (!HERO_RE.test(url)) return jsonResponse({ error: "bad url" }, { status: 400 });
        cur.hero = url;
        cur.hide = cur.hide.filter((h) => h !== url);
      } else if (action === "unhero") {
        delete cur.hero;
      } else if (action === "makefirst") {
        const photoId = typeof body.photoId === "string" ? body.photoId : "";
        const url = typeof body.url === "string" ? body.url : "";
        const i = cur.add.findIndex((x) => photoId && x.photoId === photoId || url && x.url === url);
        if (i > 0) cur.add.unshift(cur.add.splice(i, 1)[0]);
      } else {
        return jsonResponse({ error: "bad action" }, { status: 400 });
      }
      if (!cur.add.length && !cur.hide.length && !cur.hero) delete items[key];
      else items[key] = cur;
      await store4().setJSON(KEY3, items);
      if (dropFile) await photos2().delete(dropFile);
      return jsonResponse({ ok: true, item: items[key] || null });
    }
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config4 = {
  path: "/api/placephotos"
};

// ../netlify/functions/debug.mts
var debug_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req, "edit");
  if (denied) return denied;
  const check = (name) => {
    const v = Netlify.env.get(name);
    return { present: Boolean(v), length: v ? v.length : 0 };
  };
  return jsonResponse({
    TOUR_API_KEY: check("TOUR_API_KEY"),
    DURUNUBI_API_KEY: check("DURUNUBI_API_KEY"),
    FESTIVAL_API_KEY: check("FESTIVAL_API_KEY"),
    DEBUG_TEST_VAR: check("DEBUG_TEST_VAR"),
    NAVER_SEARCH_ID: check("NAVER_SEARCH_ID"),
    NAVER_SEARCH_SECRET: check("NAVER_SEARCH_SECRET")
  });
};
var config5 = {
  path: "/api/debug"
};

// ../src/lib/festivals.mts
var TOUR_API_BASE2 = "https://apis.data.go.kr/B551011/KorService2";
function todayYYYYMMDD() {
  const d = /* @__PURE__ */ new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
function toDashedDate(yyyymmdd) {
  if (!yyyymmdd) return null;
  const s = String(yyyymmdd);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
function normalize2(rawItem) {
  return {
    id: String(rawItem.contentid ?? rawItem.id),
    name: rawItem.title,
    place: rawItem.addr1 || rawItem.addr2 || "",
    startDate: toDashedDate(rawItem.eventstartdate),
    endDate: toDashedDate(rawItem.eventenddate),
    organizer: null,
    tel: rawItem.tel || null,
    homepage: null,
    address: rawItem.addr1 || rawItem.addr2 || "",
    mapX: Number(rawItem.mapx),
    mapY: Number(rawItem.mapy),
    overview: null,
    image: rawItem.firstimage || null
  };
}
async function fetchFestivals(opts) {
  if (!opts.serviceKey) {
    return { mock: true, items: mockFestivals };
  }
  const result = await callGovApi(TOUR_API_BASE2, "searchFestival2", opts.serviceKey, {
    areaCode: opts.areaCode,
    eventStartDate: todayYYYYMMDD()
  });
  return {
    mock: false,
    resultCode: result.resultCode,
    resultMsg: result.resultMsg,
    items: result.items.map(normalize2)
  };
}

// ../netlify/functions/festivals.mts
var FALLBACK_KEY2 = "";
var festivals_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const areaCode = url.searchParams.get("areaCode") || void 0;
    const result = await fetchFestivals({
      areaCode,
      serviceKey: Netlify.env.get("FESTIVAL_API_KEY") || Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY2
    });
    return jsonResponse({ ...result, count: result.items.length });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config6 = {
  path: "/api/festivals"
};

// ../src/lib/forest.mts
var RECREATION_API = "https://api.data.go.kr/openapi/tn_pubr_public_rcrfrst_api";
var MOUNTAIN_API = "https://api.odcloud.kr/api/15112801/v1/uddi:72bf80fc-1a93-4193-a6db-8a547d7c3333";
var FORESTTRAIL_API = "https://api.odcloud.kr/api/15113562/v1/uddi:64947ca3-c1c9-4e0e-a83d-8a7b813ba1bd";
var DATASETS = {
  recreation: { name: "\uC804\uAD6D\uD734\uC591\uB9BC\uD45C\uC900\uB370\uC774\uD130", page: "https://www.data.go.kr/data/15013111/standard.do" },
  mountain: { name: "\uC0B0\uB9BC\uCCAD \uAD6D\uB9BD\uC790\uC5F0\uD734\uC591\uB9BC\uAD00\uB9AC\uC18C_\uC232\uB098\uB4E4e \uC232\uAE38 100\uB300\uBA85\uC0B0 \uC815\uBCF4", page: "https://www.data.go.kr/data/15112801/fileData.do" },
  foresttrail: { name: "\uC0B0\uB9BC\uCCAD \uAD6D\uB9BD\uC790\uC5F0\uD734\uC591\uB9BC\uAD00\uB9AC\uC18C_\uC232\uB098\uB4E4e \uC232\uAE38\uC815\uBCF4", page: "https://www.data.go.kr/data/15113562/fileData.do" }
};
var SIDO_SHORT = {
  \uC11C\uC6B8\uD2B9\uBCC4\uC2DC: "\uC11C\uC6B8",
  \uC11C\uC6B8\uC2DC: "\uC11C\uC6B8",
  \uC11C\uC6B8: "\uC11C\uC6B8",
  \uBD80\uC0B0\uAD11\uC5ED\uC2DC: "\uBD80\uC0B0",
  \uBD80\uC0B0: "\uBD80\uC0B0",
  \uB300\uAD6C\uAD11\uC5ED\uC2DC: "\uB300\uAD6C",
  \uB300\uAD6C: "\uB300\uAD6C",
  \uC778\uCC9C\uAD11\uC5ED\uC2DC: "\uC778\uCC9C",
  \uC778\uCC9C: "\uC778\uCC9C",
  \uAD11\uC8FC\uAD11\uC5ED\uC2DC: "\uAD11\uC8FC",
  \uAD11\uC8FC: "\uAD11\uC8FC",
  \uB300\uC804\uAD11\uC5ED\uC2DC: "\uB300\uC804",
  \uB300\uC804: "\uB300\uC804",
  \uC6B8\uC0B0\uAD11\uC5ED\uC2DC: "\uC6B8\uC0B0",
  \uC6B8\uC0B0: "\uC6B8\uC0B0",
  \uC138\uC885\uD2B9\uBCC4\uC790\uCE58\uC2DC: "\uC138\uC885",
  \uC138\uC885: "\uC138\uC885",
  \uACBD\uAE30\uB3C4: "\uACBD\uAE30",
  \uACBD\uAE30: "\uACBD\uAE30",
  \uAC15\uC6D0\uB3C4: "\uAC15\uC6D0",
  \uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4: "\uAC15\uC6D0",
  \uAC15\uC6D0: "\uAC15\uC6D0",
  \uCDA9\uCCAD\uBD81\uB3C4: "\uCDA9\uBD81",
  \uCDA9\uBD81: "\uCDA9\uBD81",
  \uCDA9\uCCAD\uB0A8\uB3C4: "\uCDA9\uB0A8",
  \uCDA9\uB0A8: "\uCDA9\uB0A8",
  \uC804\uB77C\uBD81\uB3C4: "\uC804\uBD81",
  \uC804\uBD81\uD2B9\uBCC4\uC790\uCE58\uB3C4: "\uC804\uBD81",
  \uC804\uBD81: "\uC804\uBD81",
  \uC804\uB77C\uB0A8\uB3C4: "\uC804\uB0A8",
  \uC804\uB0A8: "\uC804\uB0A8",
  \uC804\uB0A8\uAD11\uC8FC\uD1B5\uD569\uD2B9\uBCC4\uC2DC: "\uC804\uB0A8",
  \uACBD\uC0C1\uBD81\uB3C4: "\uACBD\uBD81",
  \uACBD\uBD81: "\uACBD\uBD81",
  \uACBD\uC0C1\uB0A8\uB3C4: "\uACBD\uB0A8",
  \uACBD\uB0A8: "\uACBD\uB0A8",
  \uC81C\uC8FC\uB3C4: "\uC81C\uC8FC",
  \uC81C\uC8FC\uD2B9\uBCC4\uC790\uCE58\uB3C4: "\uC81C\uC8FC",
  \uC81C\uC8FC: "\uC81C\uC8FC"
};
function sidoShort(text3) {
  const words = String(text3 ?? "").replace(/[,·ㆍ()]/g, " ").split(/\s+/).filter(Boolean);
  for (const w of words) if (SIDO_SHORT[w]) return SIDO_SHORT[w];
  return "";
}
var CITY_SIDO = { \uC11C\uADC0\uD3EC: "\uC81C\uC8FC", \uC81C\uC8FC\uC2DC: "\uC81C\uC8FC", \uD55C\uB77C\uC0B0: "\uC81C\uC8FC" };
function sidoInText(text3) {
  const t = String(text3 ?? "");
  for (const [k, v] of Object.entries(CITY_SIDO)) if (t.includes(k) && !Object.keys(SIDO_SHORT).some((s) => s.length > 1 && t.indexOf(s) >= 0 && t.indexOf(s) < t.indexOf(k))) return v;
  let best = "";
  let at = Infinity;
  for (const [k, v] of Object.entries(SIDO_SHORT)) {
    if (k.length < 2) continue;
    const i = t.indexOf(k);
    if (i >= 0 && (i < at || i === at && k.length > best.length)) {
      at = i;
      best = v;
    }
  }
  return best;
}
var ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
function decodeEntities(s) {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
function plain(v) {
  let s = String(v ?? "");
  for (let k = 0; k < 2 && /&(#\d+|[a-z]+);/i.test(s); k++) s = decodeEntities(s);
  if (/<table/i.test(s)) s = s.replace(/<br\s*\/?>/gi, " ").replace(/<thead[\s\S]*?<\/thead>/gi, "");
  s = s.replace(/<caption[\s\S]*?<\/caption>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(tr|p|div|li|h\d)>/gi, "\n").replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, " \xB7 ").replace(/<[^>]+>/g, "").replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return s === "\uBBF8\uC785\uB825" || s === "-" ? "" : s;
}
var num = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
};
function httpsUrl(v) {
  let s = String(v ?? "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  s = s.replace(/^http:\/\//i, "https://");
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : "";
}
function inKorea(lat, lng) {
  return lat != null && lng != null && lat > 32.8 && lat < 38.9 && lng > 124 && lng < 132.2;
}
function normKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) out[k.replace(/^﻿/, "").trim()] = v;
  return out;
}
function shortHash(text3) {
  let h = 2166136261;
  for (let i = 0; i < text3.length; i++) {
    h ^= text3.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
function mapRecreation(raw) {
  const r = normKeys(raw);
  const pick2 = (...keys) => {
    for (const k of keys) if (r[k] != null && String(r[k]).trim() !== "") return String(r[k]).trim();
    return "";
  };
  const name = pick2("rcrfrstNm", "\uD734\uC591\uB9BC\uBA85");
  if (!name) return null;
  const lat = num(pick2("latitude", "\uC704\uB3C4"));
  const lng = num(pick2("longitude", "\uACBD\uB3C4"));
  const address = pick2("rdnmadr", "\uC18C\uC7AC\uC9C0\uB3C4\uB85C\uBA85\uC8FC\uC18C", "lnmadr");
  const sidoRaw = pick2("ctprvnNm", "\uC2DC\uB3C4\uBA85");
  const stayRaw = pick2("stayngPosblYn", "stayngPosblAt", "\uC219\uBC15\uAC00\uB2A5\uC5EC\uBD80").toUpperCase();
  const fee = pick2("admfee", "entrncfeeInfo", "\uC785\uC7A5\uB8CC");
  return {
    id: shortHash(name.replace(/\s+/g, "") + "|" + (lat ?? "").toString().slice(0, 6) + "|" + (lng ?? "").toString().slice(0, 7)),
    name,
    sido: sidoShort(sidoRaw) || sidoShort(address) || sidoRaw,
    kind: pick2("rcrfrstType", "rcrfrstSe", "\uD734\uC591\uB9BC\uAD6C\uBD84"),
    area: num(pick2("rcrfrstAr", "\uD734\uC591\uB9BC\uBA74\uC801")),
    capacity: num(pick2("aceptncCo", "\uC218\uC6A9\uC778\uC6D0\uC218")),
    fee: fee === "0" ? "\uBB34\uB8CC" : fee,
    stay: stayRaw === "Y" ? true : stayRaw === "N" ? false : null,
    facilities: pick2("mainFcltyNm", "\uC8FC\uC694\uC2DC\uC124\uBA85").replace(/\s*\+\s*/g, ", "),
    address,
    org: pick2("institutionNm", "\uAD00\uB9AC\uAE30\uAD00\uBA85"),
    tel: pick2("telephoneNumber", "phoneNumber", "\uD734\uC591\uB9BC\uC804\uD654\uBC88\uD638"),
    homepage: httpsUrl(pick2("homepageUrl", "\uD648\uD398\uC774\uC9C0\uC8FC\uC18C")),
    lat: inKorea(lat, lng) ? lat : null,
    lng: inKorea(lat, lng) ? lng : null,
    refDate: pick2("referenceDate", "\uB370\uC774\uD130\uAE30\uC900\uC77C\uC790")
  };
}
function dedupeRecreation(list) {
  const score = (r) => [r.tel, r.homepage, r.facilities, r.fee, r.capacity, r.address].filter((x) => x != null && x !== "").length;
  const keyOf = (r) => r.name.replace(/\(.*?\)|\s+|자연휴양림|휴양림/g, "") + "|" + (r.lat != null ? r.lat.toFixed(2) + "," + r.lng.toFixed(2) : r.address);
  const best = /* @__PURE__ */ new Map();
  for (const r of list) {
    const k = keyOf(r);
    const cur = best.get(k);
    if (!cur || r.refDate > cur.refDate || r.refDate === cur.refDate && score(r) > score(cur)) best.set(k, r);
  }
  return Array.from(best.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
function mapMountain(raw) {
  const r = normKeys(raw);
  const name = plain(r["\uBA85\uC0B0_\uC774\uB984"]);
  if (!name) return null;
  let lat = num(r["Y\uC88C\uD45C"]);
  let lng = num(r["X\uC88C\uD45C"]);
  if (lat != null && lng != null && lat > 100 && lng < 50) [lat, lng] = [lng, lat];
  const address = plain(r["\uBA85\uC0B0_\uC18C\uC7AC\uC9C0"]);
  const diff = plain(r["\uB09C\uC774\uB3C4"]).replace(/(산행시간|산높이|난이도)\s*:/g, "\n$1:").replace(/^\n/, "").replace(/[:]\s*-\s*$/m, ": -");
  return {
    id: "m" + shortHash(name + "|" + address),
    type: "mountain",
    name,
    address,
    sido: sidoShort(address) || sidoInText(address),
    height: plain(r["\uBA85\uC0B0_\uB192\uC774"]),
    difficulty: diff.split("\n").map((l) => l.trim()).filter((l) => l && !/:\s*-$/.test(l)).join("\n"),
    feature: plain(r["\uD2B9\uC9D5_\uBC0F_\uC120\uC815_\uC774\uC720"]),
    overview: plain(r["\uC0B0_\uAC1C\uC694"]),
    points: plain(r["\uC0B0\uD589\uD3EC\uC778\uD2B8"]),
    course: plain(r["\uC0B0\uD589\uCF54\uC2A4"]).split("\n").filter((l) => !/^구분\s*·/.test(l.trim())).join("\n"),
    transport: plain(r["\uAD50\uD1B5\uC815\uBCF4"]),
    lat: inKorea(lat, lng) ? lat : null,
    lng: inKorea(lat, lng) ? lng : null
  };
}
var TRAIL_ADDRESS = {
  "DMZ\uD380\uCE58\uBCFC\uB458\uB808\uAE38": "\uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4 \uC591\uAD6C\uAD70 \uD574\uC548\uBA74",
  "\uD64D\uB989\uC232 \uD0D0\uBC29": "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uB3D9\uB300\uBB38\uAD6C \uD68C\uAE30\uB85C 57",
  "\uC810\uBD09\uC0B0 \uACF0\uBC30\uB839 \uC0B0\uB9BC\uC0DD\uD0DC\uD0D0\uBC29": "\uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4 \uC778\uC81C\uAD70 \uAE30\uB9B0\uBA74 \uC9C4\uB3D9\uB9AC",
  "\uBC31\uB450\uB300\uAC04\uD2B8\uB808\uC77C": "\uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4 \uC778\uC81C\uAD70 \uAE30\uB9B0\uBA74 \uB0B4\uB9B0\uCC9C\uB85C 4096-3",
  "\uC6B8\uC9C4\uAE08\uAC15\uC18C\uB098\uBB34\uC232\uAE38": "\uACBD\uC0C1\uBD81\uB3C4 \uC6B8\uC9C4\uAD70 \uADFC\uB0A8\uBA74 \uC6B8\uC9C4\uBD81\uB85C 245-5",
  "\uD55C\uB0A8\uC2DC\uD5D8\uB9BC\uD0D0\uBC29": "\uC81C\uC8FC\uD2B9\uBCC4\uC790\uCE58\uB3C4 \uC11C\uADC0\uD3EC\uC2DC \uB0A8\uC6D0\uC74D \uC11C\uC131\uB85C651\uBC88\uAE38 235"
};
function groupForestTrails(rows) {
  const map = /* @__PURE__ */ new Map();
  for (const raw of rows) {
    const r = normKeys(raw);
    const name = plain(r["\uD734\uC591\uB9BC\uBA85"]);
    if (!name) continue;
    const gid = String(r["\uD734\uC591\uB9BC\uC544\uC774\uB514"] || name);
    let t = map.get(gid);
    if (!t) {
      t = { id: "f" + shortHash(gid), type: "foresttrail", name, sido: "", address: TRAIL_ADDRESS[name] || "", spot: "", transport: "", stay: "", dailyLimit: null, courses: [] };
      map.set(gid, t);
    }
    const longer = (a, b) => b.length > a.length ? b : a;
    t.spot = longer(t.spot, plain(r["\uAD00\uB9AC\uC9C0\uC810\uC124\uBA85"]));
    t.transport = longer(t.transport, plain(r["\uAD50\uD1B5\uD3B8\uC124\uBA85"]));
    t.stay = longer(t.stay, plain(r["\uC219\uBC15\uC815\uBCF4\uC124\uBA85"]));
    const lim = num(r["\uC77C\uC77C\uC608\uC57D\uAC00\uB2A5\uAC74\uC218"]);
    if (lim != null) t.dailyLimit = Math.max(t.dailyLimit ?? 0, lim);
    const h = num(r["\uC0B0_\uC18C\uC694\uC2DC\uAC04"]) || 0;
    const m = num(r["\uC18C\uC694\uC2DC\uAC04_\uBD84"]) || 0;
    const course = {
      name: plain(r["\uC0C1\uD488\uBA85"]),
      level: plain(r["\uC232\uAE38\uAD6C\uAC04\uB09C\uC774\uB3C4"]),
      way: plain(r["\uAC70\uB9AC\uAD6C\uAC04\uAD6C\uBD84"]),
      time: h || m ? (h ? h + "\uC2DC\uAC04" : "") + (m ? (h ? " " : "") + m + "\uBD84" : "") : "",
      km: num(r["\uC232\uAE38\uAD6C\uAC04\uAE38\uC774"]),
      from: plain(r["\uAD6C\uAC04_\uC2DC\uC810\uBA85"]),
      to: plain(r["\uAD6C\uAC04_\uC885\uC810\uBA85"])
    };
    const same2 = t.courses.find((c) => c.name === course.name && c.from === course.from && c.to === course.to);
    if (!same2 && course.name) t.courses.push(course);
  }
  const out = Array.from(map.values());
  for (const t of out) t.sido = sidoShort(t.address) || sidoInText(t.spot) || sidoInText(t.transport) || sidoInText(t.name);
  return out.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

// ../netlify/functions/forest.mts
var FALLBACK_KEY3 = "";
var TTL_MS2 = 7 * 24 * 60 * 60 * 1e3;
var cache2 = () => getStore("cache");
var NeedApply = class extends Error {
  constructor(dataset, detail) {
    super("need-apply: " + detail);
    this.dataset = dataset;
  }
};
function looksUnregistered(status, text3) {
  return status === 401 || status === 403 || /SERVICE_KEY_IS_NOT_REGISTERED|SERVICE_ACCESS_DENIED|등록되지 않은 인증키|인증키|"code"\s*:\s*-4|<returnReasonCode>\s*(30|20)\s*</i.test(text3);
}
async function getText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(12e3), headers: { Accept: "application/json" } });
  return { status: res.status, text: await res.text() };
}
async function fetchRecreation(key, debug) {
  const rows = [];
  let total = Infinity;
  let sample = null;
  for (let page = 1; rows.length < total && page <= 10; page++) {
    const url = `${RECREATION_API}?serviceKey=${encodeURIComponent(key)}&pageNo=${page}&numOfRows=1000&type=json`;
    const { status, text: text3 } = await getText(url);
    if (looksUnregistered(status, text3)) throw new NeedApply("recreation", text3.slice(0, 200));
    let data;
    try {
      data = JSON.parse(text3);
    } catch {
      throw new Error(`recreation: not json (${status}) ${text3.slice(0, 160)}`);
    }
    const root = data?.response || data || {};
    const header = root.header || {};
    const code = String(header.resultCode ?? data?.resultCode ?? "");
    if (code && code !== "00" && code !== "0000" && code !== "03") {
      if (code === "30" || code === "20") throw new NeedApply("recreation", `${code} ${header.resultMsg || ""}`);
      throw new Error(`recreation: ${code} ${header.resultMsg || data?.resultMsg || ""}`);
    }
    const body = root.body || {};
    let items = body.items;
    if (items && !Array.isArray(items)) items = Array.isArray(items.item) ? items.item : items.item ? [items.item] : [];
    items = items || [];
    if (!sample && items[0]) sample = items[0];
    rows.push(...items);
    total = Number(body.totalCount) || rows.length;
    if (!items.length) break;
  }
  const list = dedupeRecreation(rows.map(mapRecreation).filter(Boolean));
  return { items: list, rawCount: rows.length, ...debug ? { sample } : {} };
}
async function fetchOdcloud(base, dataset, key) {
  const rows = [];
  let total = Infinity;
  for (let page = 1; rows.length < total && page <= 10; page++) {
    const url = `${base}?page=${page}&perPage=500&returnType=JSON&serviceKey=${encodeURIComponent(key)}`;
    const { status, text: text3 } = await getText(url);
    if (looksUnregistered(status, text3)) throw new NeedApply(dataset, text3.slice(0, 200));
    let data;
    try {
      data = JSON.parse(text3);
    } catch {
      throw new Error(`${dataset}: not json (${status}) ${text3.slice(0, 160)}`);
    }
    if (!Array.isArray(data?.data)) throw new Error(`${dataset}: ${status} ${text3.slice(0, 160)}`);
    rows.push(...data.data);
    total = Number(data.totalCount) || rows.length;
    if (!data.data.length) break;
  }
  return rows;
}
async function fetchTrails(key, debug) {
  const [m, f] = await Promise.allSettled([
    fetchOdcloud(MOUNTAIN_API, "mountain", key),
    fetchOdcloud(FORESTTRAIL_API, "foresttrail", key)
  ]);
  const needApply = [];
  const errors = [];
  for (const r of [m, f]) {
    if (r.status === "rejected") {
      if (r.reason instanceof NeedApply) needApply.push(r.reason.dataset);
      else errors.push(String(r.reason?.message || r.reason));
    }
  }
  const mountains = m.status === "fulfilled" ? m.value.map(mapMountain).filter(Boolean) : [];
  const trails = f.status === "fulfilled" ? groupForestTrails(f.value) : [];
  return {
    items: [...trails, ...mountains],
    needApply,
    errors,
    complete: m.status === "fulfilled" && f.status === "fulfilled",
    ...debug ? { sample: { mountain: m.status === "fulfilled" ? m.value[0] : null, foresttrail: f.status === "fulfilled" ? f.value[0] : null } } : {}
  };
}
function applyInfo(names) {
  return names.map((n) => DATASETS[n]).filter(Boolean);
}
var forest_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const type = q.get("type") || "";
  const debug = q.get("debug") === "1";
  if (type !== "recreation" && type !== "trails") return jsonResponse({ error: "bad type" }, { status: 400 });
  const cKey = `forest-${type}-v2`;
  const key = Netlify.env.get("FOREST_API_KEY") || Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY3;
  let saved = null;
  try {
    saved = await cache2().get(cKey, { type: "json" });
  } catch {
    saved = null;
  }
  if (!debug && saved && Date.now() - (saved.at || 0) < TTL_MS2) return jsonResponse({ ...saved, cached: true });
  try {
    if (type === "recreation") {
      const r = await fetchRecreation(key, debug);
      const out2 = { at: Date.now(), updatedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), total: r.items.length, items: r.items };
      if (!debug && r.items.length) await cache2().setJSON(cKey, out2);
      return jsonResponse(debug ? { ...out2, rawCount: r.rawCount, sample: r.sample } : out2);
    }
    const t = await fetchTrails(key, debug);
    if (!t.items.length) {
      if (saved) return jsonResponse({ ...saved, cached: true, stale: true });
      if (t.needApply.length) return jsonResponse({ error: "need-apply", apply: applyInfo(t.needApply), errors: t.errors }, { status: 503 });
      return jsonResponse({ error: t.errors.join(" / ") || "no data" }, { status: 502 });
    }
    const out = { at: Date.now(), updatedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), total: t.items.length, items: t.items, apply: applyInfo(t.needApply) };
    if (!debug && t.complete) await cache2().setJSON(cKey, out);
    return jsonResponse(debug ? { ...out, errors: t.errors, sample: t.sample } : out);
  } catch (err) {
    if (saved) return jsonResponse({ ...saved, cached: true, stale: true });
    if (err instanceof NeedApply) return jsonResponse({ error: "need-apply", apply: applyInfo([err.dataset]) }, { status: 503 });
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 502 });
  }
};
var config7 = {
  path: "/api/forest"
};

// ../netlify/functions/golf.mts
var FALLBACK_KEY4 = "";
var GOLF_API = "https://api.odcloud.kr/api/15118920/v1/uddi:0e5b12d2-1cc8-4caf-ba96-c2c7d1ef8d83";
var DATASET = { name: "\uBB38\uD654\uCCB4\uC721\uAD00\uAD11\uBD80_\uC804\uAD6D \uACE8\uD504\uC7A5 \uD604\uD669", page: "https://www.data.go.kr/data/15118920/fileData.do" };
var GEOCODE = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode";
var TOUR_BASE = "https://apis.data.go.kr/B551011/KorService2";
var DEFAULT_KEY_ID = "5v6q8ev03k";
var TTL_MS3 = 30 * 24 * 60 * 60 * 1e3;
var TIME_BUDGET_MS = 7e3;
async function sha1(text3) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text3));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var r5 = (v) => Math.round(v * 1e5) / 1e5;
function cleanAddress(a) {
  return String(a || "").split(/[,;\/]|\s외\s|\(/)[0].replace(/일원|일대|번지|외\s*\d+\s*필지/g, " ").replace(/\s+/g, " ").trim();
}
async function geocodeNaver(query, keyId, secret) {
  const res = await fetch(`${GEOCODE}?query=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(5e3),
    headers: { "x-ncp-apigw-api-key-id": keyId, "x-ncp-apigw-api-key": secret }
  });
  if (!res.ok) throw new Error(`geocode http ${res.status}`);
  const j = await res.json();
  const a = j?.addresses?.[0];
  if (!a) return null;
  const lat = Number(a.y), lng = Number(a.x);
  return lat > 32 && lat < 39 && lng > 124 && lng < 132 ? [lat, lng] : null;
}
async function findByName(name, sido2, tourKey) {
  const r = await callGovApi(TOUR_BASE, "searchKeyword2", tourKey, { keyword: name.replace(/\(.*?\)/g, "").trim(), numOfRows: 20 });
  const hit = r.items.find((it) => /골프|CC|컨트리|GC/i.test(String(it.title)) && Number(it.mapy) > 32 && (!sido2 || sidoShort(it.addr1) === sido2));
  return hit ? [Number(hit.mapy), Number(hit.mapx)] : null;
}
var golf_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const share = await viewerShare(req);
  if (share && !share.tabs.golf) return jsonResponse({ items: [], total: 0, located: 0, pending: 0, hidden: true });
  const store14 = getStore("cache");
  const full = await store14.get("golf-v1", { type: "json" });
  if (full && Date.now() - (full.at || 0) < TTL_MS3) return jsonResponse({ ...full, cached: true });
  const key = Netlify.env.get("GOLF_API_KEY") || Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY4;
  const res = await fetch(`${GOLF_API}?page=1&perPage=2000&serviceKey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(1e4) });
  const text3 = await res.text();
  let data;
  try {
    data = JSON.parse(text3);
  } catch {
    return jsonResponse({ error: `not json (${res.status}) ${text3.slice(0, 120)}` }, { status: 502 });
  }
  if (data?.code === -401 || res.status === 401 || res.status === 403) return jsonResponse({ error: "need-apply", apply: [DATASET] }, { status: 503 });
  const rows = Array.isArray(data?.data) ? data.data : [];
  if (!rows.length) return jsonResponse({ error: "empty", detail: text3.slice(0, 160) }, { status: 502 });
  const secret = Netlify.env.get("NAVER_MAP_SECRET") || "";
  const keyId = Netlify.env.get("NAVER_MAP_KEY_ID") || DEFAULT_KEY_ID;
  const started = Date.now();
  let pending = 0;
  const items = [];
  let idx = 0;
  const base = (await Promise.all(rows.map(async (r) => {
    const address = String(r["\uC18C\uC7AC\uC9C0"] || "").trim();
    const region = String(r["\uC9C0\uC5ED"] || "").trim();
    return {
      id: (await sha1(String(r["\uC774\uB984"] || "").trim() + "|" + address)).slice(0, 12),
      order: 0,
      name: String(r["\uC774\uB984"] || "").trim(),
      region,
      sido: sidoShort(region) || sidoShort(address) || region.slice(0, 2),
      owner: String(r["\uC0AC\uC5C5\uC790"] || "").trim(),
      address,
      area: Number(r["\uBA74\uC801(\uC81C\uACF1\uBBF8\uD130)"]) || null,
      holes: Number(r["\uD640"]) || null,
      kind: String(r["\uAD6C\uBD84"] || "").trim(),
      lat: null,
      lng: null
    };
  }))).filter((x) => x.name);
  base.forEach((x, i) => {
    x.order = i;
  });
  async function worker() {
    while (idx < base.length) {
      const g = base[idx++];
      const q = cleanAddress(g.address);
      const gKey = `geo-v1-${await sha1(g.name + "|" + q)}`;
      let hit = await store14.get(gKey, { type: "json" });
      if (!hit) {
        if (Date.now() - started > TIME_BUDGET_MS) {
          pending++;
          items.push(g);
          continue;
        }
        let ll = null;
        try {
          if (secret && q) {
            ll = await geocodeNaver(q, keyId, secret);
            if (!ll) {
              const shorter = q.split(" ").slice(0, -1).join(" ");
              if (shorter.split(" ").length >= 3) ll = await geocodeNaver(shorter, keyId, secret);
            }
          }
          if (!ll) ll = await findByName(g.name, g.sido, key);
          hit = ll ? { lat: r5(ll[0]), lng: r5(ll[1]) } : { none: true };
          await store14.setJSON(gKey, hit);
        } catch {
          pending++;
          items.push(g);
          continue;
        }
      }
      if (!hit.none) {
        g.lat = hit.lat;
        g.lng = hit.lng;
      }
      items.push(g);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  items.sort((a, b) => a.order - b.order);
  const out = { at: Date.now(), total: items.length, located: items.filter((x) => x.lat != null).length, pending, geocoder: secret ? "naver" : "tour-only", items };
  if (!pending) await store14.setJSON("golf-v1", out);
  return jsonResponse(out, { headers: { "Cache-Control": "no-store" } });
};
var config8 = {
  path: "/api/golf"
};

// ../netlify/functions/golfosm.mts
var ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
var UA = "TravelStory/1.0 (https://travel-story-api.netlify.app; personal travel diary)";
var TTL_MS4 = 30 * 24 * 60 * 60 * 1e3;
var TTL_NONE_MS = 7 * 24 * 60 * 60 * 1e3;
var r52 = (v) => Math.round(v * 1e5) / 1e5;
var norm = (s) => String(s ?? "").replace(/\s+|\(.*?\)|골프클럽|골프장|컨트리클럽|cc|gc|golf|club|country/gi, "").toLowerCase();
function km(a, b) {
  const R = 6371, t = Math.PI / 180;
  const x = Math.sin((b[0] - a[0]) * t / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin((b[1] - a[1]) * t / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function inRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if (yi > p[0] !== yj > p[0] && p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function bboxOf(rings) {
  let s = 90, w = 180, n = -90, e = -180;
  for (const r of rings) for (const [la, lo] of r) {
    s = Math.min(s, la);
    n = Math.max(n, la);
    w = Math.min(w, lo);
    e = Math.max(e, lo);
  }
  return [s, w, n, e];
}
function thin(pts, max = 300) {
  if (pts.length <= max) return pts;
  const step = Math.ceil(pts.length / max);
  const out = pts.filter((_, i) => i % step === 0);
  out.push(pts[pts.length - 1]);
  return out;
}
var geomOf = (g) => (g || []).filter((x) => x && x.lat != null).map((x) => [r52(x.lat), r52(x.lon)]);
async function overpass(q) {
  let last = "";
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: "data=" + encodeURIComponent(q),
        signal: AbortSignal.timeout(12e3)
      });
      const text3 = await res.text();
      if (!res.ok) {
        last = `http ${res.status}`;
        continue;
      }
      return JSON.parse(text3);
    } catch (err) {
      last = err?.message || String(err);
    }
  }
  throw new Error("overpass: " + last);
}
var golfosm_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
  if (!(lat > 32 && lat < 39.5 && lng > 124 && lng < 132)) return jsonResponse({ error: "bad lat/lng" }, { status: 400 });
  const name = (q.get("name") || "").slice(0, 40);
  const debug = q.get("debug") === "1";
  const store14 = getStore("cache");
  const cKey = `gosm-v1-${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (!debug) {
    const hit = await store14.get(cKey, { type: "json" });
    if (hit && Date.now() - (hit.at || 0) < (hit.none ? TTL_NONE_MS : TTL_MS4)) return jsonResponse({ ...hit, cached: true });
  }
  try {
    const query = `[out:json][timeout:20];(way["leisure"="golf_course"](around:2500,${lat},${lng});relation["leisure"="golf_course"](around:2500,${lat},${lng});way["golf"="hole"](around:3500,${lat},${lng}););out geom;`;
    const data = await overpass(query);
    const els = Array.isArray(data?.elements) ? data.elements : [];
    const me = [lat, lng];
    const courses = els.filter((e) => e.tags?.leisure === "golf_course").map((e) => {
      const rings = e.type === "way" ? [geomOf(e.geometry)] : (e.members || []).filter((m) => m.type === "way" && (m.role === "outer" || m.role === "")).map((m) => geomOf(m.geometry));
      const good = rings.filter((r) => r.length >= 3);
      const bb = bboxOf(good);
      const center = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
      const contains = good.some((r) => r.length >= 4 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] && inRing(me, r)) || me[0] >= bb[0] && me[0] <= bb[2] && me[1] >= bb[1] && me[1] <= bb[3] && good.length > 0;
      return { name: String(e.tags?.name || ""), rings: good, bb, center, contains, sameName: !!name && !!e.tags?.name && (norm(e.tags.name).includes(norm(name)) || norm(name).includes(norm(e.tags.name))) };
    }).filter((c) => c.rings.length);
    const pick2 = courses.find((c) => c.contains && c.sameName) || courses.find((c) => c.sameName && km(me, c.center) < 3) || courses.find((c) => c.contains) || courses.filter((c) => km(me, c.center) < 1.5).sort((a, b) => km(me, a.center) - km(me, b.center))[0] || null;
    const inside = (p) => pick2 ? p[0] >= pick2.bb[0] - 2e-3 && p[0] <= pick2.bb[2] + 2e-3 && p[1] >= pick2.bb[1] - 2e-3 && p[1] <= pick2.bb[3] + 2e-3 : km(me, p) < 1.5;
    const holes = els.filter((e) => e.tags?.golf === "hole").map((e) => {
      const pts = geomOf(e.geometry);
      return {
        ref: String(e.tags.ref || "").slice(0, 8),
        par: Number(e.tags.par) || null,
        name: String(e.tags.name || "").slice(0, 40),
        hcp: Number(e.tags.handicap) || null,
        pts: thin(pts, 60)
      };
    }).filter((h) => h.pts.length >= 2 && inside(h.pts[Math.floor(h.pts.length / 2)]));
    const group = (h) => String(h.name || "").replace(/\s*\d+\s*$/, "");
    holes.sort((a, b) => group(a).localeCompare(group(b)) || (Number(a.ref) || 99) - (Number(b.ref) || 99));
    const out = {
      at: Date.now(),
      course: pick2 ? { name: pick2.name, rings: pick2.rings.map((r) => thin(r)), bbox: pick2.bb.map(r52) } : null,
      holes
    };
    if (!out.course && !holes.length) out.none = true;
    if (!debug) await store14.setJSON(cKey, out);
    return jsonResponse(out);
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 502 });
  }
};
var config9 = {
  path: "/api/golfosm"
};

// ../netlify/functions/glog.mts
var store5 = () => getStore({ name: "glog", consistency: "strong" });
var MAX_ERRORS = 40;
var MAX_DEVICES = 4;
var MAX_USAGE_KEYS = 120;
var MAX_ANON_DEVS = 300;
function anonList(g, skipName = "") {
  if (!Array.isArray(g.anonDevs)) {
    g.anonDevs = (g.devices || []).filter((d) => d.name !== skipName).map((d, i) => ({ id: "old-" + i, name: d.name, w: d.w, h: d.h, app: d.app, first: d.at, last: d.at, visits: 0, errs: 0 }));
  }
  return g.anonDevs;
}
function reply2(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
var str = (v, n) => (typeof v === "string" ? v : v == null ? "" : String(v)).replace(/[\u0000-\u001f]+/g, " ").slice(0, n);
var num2 = (v, max) => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) && x > 0 ? Math.min(x, max) : 0;
};
async function readMeta() {
  return await store5().get("meta", { type: "json" }) || { unread: 0, lastErrAt: 0 };
}
var glog_default = async (req, _context) => {
  try {
    const a = await accessOf(req, true);
    const url = new URL(req.url);
    if (req.method === "GET") {
      if (!a.canEdit) return reply2({ error: "edit not allowed" }, 403);
      if (url.searchParams.get("count")) {
        const m2 = await readMeta();
        return reply2({ ok: true, unread: m2.unread || 0, lastErrAt: m2.lastErrAt || 0 });
      }
      const keys = (await store5().list({ prefix: "u-" })).blobs.map((b) => b.key);
      keys.push("anon");
      const logs = [];
      for (const k of keys) {
        const g2 = await store5().get(k, { type: "json" });
        if (g2) logs.push(g2);
      }
      logs.sort((x, y) => (y.last || 0) - (x.last || 0));
      const m = await readMeta();
      return reply2({ ok: true, logs, unread: m.unread || 0 });
    }
    if (req.method !== "POST") return reply2({ error: "method not allowed" }, 405);
    let body = {};
    try {
      body = JSON.parse(await req.text());
    } catch {
      body = {};
    }
    if (body?.action === "anondel" || body?.action === "anonclear") {
      if (!a.canEdit) return reply2({ error: "edit not allowed" }, 403);
      const g2 = await store5().get("anon", { type: "json" });
      if (g2) {
        if (body.action === "anonclear") await store5().delete("anon");
        else {
          const did = String(body.did || "");
          g2.anonDevs = anonList(g2).filter((d) => d.id !== did);
          g2.devices = (g2.devices || []).filter((d) => g2.anonDevs.some((x) => x.name === d.name));
          await store5().setJSON("anon", g2);
        }
      }
      let unread = 0;
      for (const k of (await store5().list({ prefix: "u-" })).blobs.map((b) => b.key).concat(["anon"])) {
        const x = await store5().get(k, { type: "json" });
        if (x) unread += x.unread || 0;
      }
      const m = await readMeta();
      m.unread = unread;
      await store5().setJSON("meta", m);
      return reply2({ ok: true, unread });
    }
    if (body?.action === "seen" || body?.action === "clear") {
      if (!a.canEdit) return reply2({ error: "edit not allowed" }, 403);
      const keys = body.action === "clear" ? [String(body.id || "")] : (await store5().list({ prefix: "u-" })).blobs.map((b) => b.key).concat(["anon"]);
      for (const k of keys) {
        if (!/^(u-[0-9a-f]{16}|anon)$/.test(k)) continue;
        const g2 = await store5().get(k, { type: "json" });
        if (!g2) continue;
        if (body.action === "clear") g2.errors = [];
        g2.unread = 0;
        await store5().setJSON(k, g2);
      }
      const all = (await store5().list({ prefix: "u-" })).blobs.map((b) => b.key).concat(["anon"]);
      let unread = 0;
      if (body.action === "clear") for (const k of all) {
        const g2 = await store5().get(k, { type: "json" });
        if (g2) unread += g2.unread || 0;
      }
      const m = await readMeta();
      m.unread = unread;
      await store5().setJSON("meta", m);
      return reply2({ ok: true, unread });
    }
    if (a.canEdit) return reply2({ ok: true, skip: true });
    if (!a.linkOk || a.blocked) return reply2({ error: "link required" }, 401);
    const key = a.guest ? "u-" + a.guest.id : "anon";
    const now = Date.now();
    const g = await store5().get(key, { type: "json" }) || {
      id: a.guest ? a.guest.id : "anon",
      nick: a.guest ? a.guest.nickname : "\uB85C\uADF8\uC778 \uC804 \uBC29\uBB38\uC790",
      first: now,
      last: now,
      sessions: 0,
      usage: {},
      devices: [],
      errors: [],
      errTotal: 0,
      unread: 0
    };
    if (a.guest) g.nick = a.guest.nickname;
    g.last = now;
    if (body?.session) g.sessions = (g.sessions || 0) + 1;
    const usage = body?.usage && typeof body.usage === "object" ? body.usage : {};
    for (const [k0, v] of Object.entries(usage).slice(0, 60)) {
      const k = str(k0, 40).trim();
      const n = num2(v, 500);
      if (!k || !n) continue;
      if (!(k in g.usage) && Object.keys(g.usage).length >= MAX_USAGE_KEYS) continue;
      g.usage[k] = (g.usage[k] || 0) + n;
    }
    const dv = body?.device;
    let devName = "";
    if (dv && typeof dv === "object") {
      devName = str(dv.name, 80);
      if (devName) {
        const d = { name: devName, w: num2(dv.w, 1e4), h: num2(dv.h, 1e4), app: !!dv.app, at: now };
        g.devices = [d].concat((g.devices || []).filter((x) => x.name !== devName)).slice(0, MAX_DEVICES);
      }
    }
    const errs = Array.isArray(body?.errors) ? body.errors.slice(0, 10) : [];
    let added = 0;
    for (const e of errs) {
      const msg = str(e?.msg, 300).trim();
      if (!msg) continue;
      const where = str(e?.where, 300), view = str(e?.view, 40), dev = str(e?.dev, 80) || devName;
      const same2 = g.errors.find((x) => x.msg === msg && x.where === where);
      if (same2) {
        same2.n = (same2.n || 1) + 1;
        same2.at = now;
        same2.view = view || same2.view;
        same2.dev = dev || same2.dev;
        g.errors = [same2].concat(g.errors.filter((x) => x !== same2));
      } else g.errors.unshift({ at: now, msg, where, view, dev, n: 1 });
      g.errTotal = (g.errTotal || 0) + 1;
      g.unread = (g.unread || 0) + 1;
      added++;
    }
    g.errors = g.errors.slice(0, MAX_ERRORS);
    if (!a.guest && dv && typeof dv === "object" && devName) {
      const list = anonList(g, devName);
      const rawId = String(dv.id || "");
      const id = /^[a-z0-9]{8,32}$/.test(rawId) ? rawId : "nm-" + devName.slice(0, 60);
      let d = list.find((x) => x.id === id);
      if (!d) {
        d = { id, name: devName, w: 0, h: 0, app: false, first: now, last: now, visits: 0, errs: 0 };
        list.unshift(d);
      }
      d.name = devName;
      d.w = num2(dv.w, 1e4);
      d.h = num2(dv.h, 1e4);
      d.app = !!dv.app;
      d.last = now;
      if (body?.session) d.visits = (d.visits || 0) + 1;
      d.errs = (d.errs || 0) + added;
      g.anonDevs = list.sort((x, y) => y.last - x.last).slice(0, MAX_ANON_DEVS);
    }
    await store5().setJSON(key, g);
    if (added) {
      const m = await readMeta();
      m.unread = (m.unread || 0) + added;
      m.lastErrAt = now;
      await store5().setJSON("meta", m);
    }
    return reply2({ ok: true });
  } catch (e) {
    return reply2({ error: "failed" }, 500);
  }
};
var config10 = {
  path: "/api/glog"
};

// ../netlify/functions/gphotos.mts
var EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
var TYPE = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
var ID_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
var MAX_BYTES = 3 * 1024 * 1024;
var store6 = () => getStore({ name: "gphotos", consistency: "strong" });
var MAX_THUMB = 600 * 1024;
var tkey = (id) => id.replace(/\.[a-z]+$/, "") + ".t.jpg";
async function sha2562(text3) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text3));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var gphotos_default = async (req, context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const a = await accessOf(req);
  if (!a.canView) return jsonResponse({ error: a.needGuest ? "guest-login" : "link required" }, { status: 401 });
  if (!a.canEdit && !a.guest) {
    const share = await readShare(req.method !== "GET");
    if (!share.tabs.gstory) return jsonResponse({ error: "not found" }, { status: 404 });
  }
  const id = context.params?.id;
  const url = new URL(req.url);
  const wantThumb = url.searchParams.get("t") === "1";
  try {
    if (req.method === "POST" && id && wantThumb) {
      if (!ID_RE.test(id)) return jsonResponse({ error: "not found" }, { status: 404 });
      const meta = await store6().getMetadata(id);
      if (!meta) return jsonResponse({ error: "not found" }, { status: 404 });
      if (!a.canEdit) {
        const token = (req.headers.get("x-author") || "").trim();
        const author = a.guest ? await sha2562("gs|acct|" + a.guest.id) : /^[A-Za-z0-9_-]{24,100}$/.test(token) ? await sha2562("gs|" + token) : "";
        if (!author || meta.metadata?.author !== author) return jsonResponse({ error: "not yours" }, { status: 403 });
      }
      const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (type !== "image/jpeg") return jsonResponse({ error: "unsupported image type" }, { status: 415 });
      const body = await req.arrayBuffer();
      if (!body.byteLength || body.byteLength > MAX_THUMB) return jsonResponse({ error: "bad thumbnail size" }, { status: 413 });
      await store6().set(tkey(id), body, { metadata: meta.metadata || {} });
      return jsonResponse({ ok: true }, { status: 201 });
    }
    if (req.method === "GET" && !id && url.searchParams.get("need") != null) {
      if (!a.canEdit) return jsonResponse({ error: "forbidden" }, { status: 403 });
      const ids = url.searchParams.get("need").split(",").filter((x) => ID_RE.test(x)).slice(0, 60);
      const need = [];
      for (const x of ids) {
        if (!await store6().getMetadata(tkey(x))) need.push(x);
      }
      return jsonResponse({ need }, { headers: { "Cache-Control": "no-store" } });
    }
    if (req.method === "POST" && !id) {
      const token = (req.headers.get("x-author") || "").trim();
      if (!a.canEdit && !a.guest && !/^[A-Za-z0-9_-]{24,100}$/.test(token)) return jsonResponse({ error: "author key required" }, { status: 400 });
      const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const ext = EXT[type];
      if (!ext) return jsonResponse({ error: "unsupported image type" }, { status: 415 });
      const body = await req.arrayBuffer();
      if (!body.byteLength) return jsonResponse({ error: "empty body" }, { status: 400 });
      if (body.byteLength > MAX_BYTES) return jsonResponse({ error: "image too large" }, { status: 413 });
      const newId = `${crypto.randomUUID()}.${ext}`;
      const author = a.guest ? await sha2562("gs|acct|" + a.guest.id) : token ? await sha2562("gs|" + token) : "owner";
      await store6().set(newId, body, { metadata: { author, at: Date.now() } });
      return jsonResponse({ id: newId }, { status: 201 });
    }
    if (req.method === "GET" && id) {
      if (!ID_RE.test(id)) return jsonResponse({ error: "not found" }, { status: 404 });
      if (wantThumb) {
        const th = await store6().get(tkey(id), { type: "arrayBuffer" });
        if (th) return new Response(th, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000, immutable", "x-thumb": "yes" } });
        const orig = await store6().get(id, { type: "arrayBuffer" });
        if (!orig) return jsonResponse({ error: "not found" }, { status: 404 });
        return new Response(orig, { headers: { "content-type": TYPE[id.split(".").pop()], "cache-control": "private, max-age=600", "x-thumb": "no" } });
      }
      const data = await store6().get(id, { type: "arrayBuffer" });
      if (!data) return jsonResponse({ error: "not found" }, { status: 404 });
      return new Response(data, { headers: { "content-type": TYPE[id.split(".").pop()], "cache-control": "private, max-age=31536000, immutable" } });
    }
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config11 = {
  path: ["/api/gphotos", "/api/gphotos/:id"]
};

// ../src/lib/golfscore.mts
var int = (v, min, max) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
var str2 = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
function cleanGolf(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.holes)) return null;
  const n = input.holes.length >= 18 ? 18 : 9;
  const holes = Array.from({ length: n }, (_, i) => {
    const h = input.holes[i] || {};
    return { par: int(h.par, 3, 6) ?? 4, strokes: int(h.strokes, 1, 20), putts: int(h.putts, 0, 10) };
  });
  const played = holes.filter((h) => h.strokes != null);
  const review = str2(input.review, 3e3);
  if (!played.length && !review) return null;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  return {
    course: str2(input.course, 100),
    courseKey: typeof input.courseKey === "string" && /^g:[0-9a-f]{12}$/.test(input.courseKey) ? input.courseKey : null,
    front: str2(input.front, 20),
    back: n === 18 ? str2(input.back, 20) : "",
    holes,
    total: played.length ? sum(played.map((h) => h.strokes)) : null,
    par: played.length ? sum(played.map((h) => h.par)) : null,
    // 친 홀의 파 합계 (오버/언더 계산용)
    putts: holes.some((h) => h.putts != null) ? sum(holes.map((h) => h.putts || 0)) : null,
    played: played.length,
    review
  };
}

// ../src/lib/hikerec.mts
var str3 = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
var num3 = (v, min, max, dp = 0) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
var hhmm = (v) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "";
var mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
var LEVELS = ["\uC26C\uC6C0", "\uBCF4\uD1B5", "\uD798\uB4E6"];
function cleanHike(input) {
  if (!input || typeof input !== "object") return null;
  const start = hhmm(input.start), summit = hhmm(input.summit), end = hhmm(input.end);
  let minutes = null;
  if (start && end) {
    minutes = mins(end) - mins(start);
    if (minutes <= 0) minutes += 1440;
  } else minutes = num3(input.minutes, 1, 2880);
  const out = {
    mountain: str3(input.mountain, 60),
    course: str3(input.course, 100),
    start,
    summit,
    end,
    minutes,
    km: num3(input.km, 0.1, 200, 1),
    ascent: num3(input.ascent, 0, 9e3),
    summitAlt: num3(input.summitAlt, 0, 9e3),
    reached: input.reached === true,
    level: LEVELS.includes(input.level) ? input.level : "",
    with: str3(input.with, 100),
    review: str3(input.review, 3e3)
  };
  const has = out.course || start || summit || end || out.minutes != null || out.km != null || out.ascent != null || out.summitAlt != null || out.reached || out.level || out.with || out.review;
  return has ? out : null;
}

// ../netlify/functions/gstories.mts
var store7 = () => getStore({ name: "gstories", consistency: "strong" });
var gphotos = () => getStore({ name: "gphotos", consistency: "strong" });
var PHOTO_RE3 = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
var MAX_PHOTOS = 10;
var STATUSES = ["ok", "pending", "hidden"];
var str4 = (v, max) => typeof v === "string" ? v.replace(/\s+$/g, "").trim().slice(0, max) : "";
var num4 = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
async function sha2563(text3) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text3));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function clean(input) {
  const photoIds = [];
  for (const id of Array.isArray(input?.photoIds) ? input.photoIds : []) {
    if (typeof id === "string" && PHOTO_RE3.test(id) && !photoIds.includes(id)) photoIds.push(id);
    if (photoIds.length >= MAX_PHOTOS) break;
  }
  const lat = num4(input?.lat), lng = num4(input?.lng);
  const okLL = lat != null && lng != null && lat > 32 && lat < 39.5 && lng > 124 && lng < 132;
  return {
    nickname: str4(input?.nickname, 20),
    title: str4(input?.title, 100) || "\uC81C\uBAA9 \uC5C6\uC74C",
    date: /^\d{4}-\d{2}-\d{2}$/.test(input?.date) ? input.date : new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10),
    place: str4(input?.place, 100),
    region: str4(input?.region, 10),
    memo: str4(input?.memo, 5e3),
    photoIds,
    lat: okLL ? lat : null,
    lng: okLL ? lng : null,
    golf: cleanGolf(input?.golf),
    hike: cleanHike(input?.hike)
  };
}
async function ownPhotos(ids, authors, isOwner, keep = []) {
  const ok = [];
  for (const p of ids) {
    if (keep.includes(p)) {
      ok.push(p);
      continue;
    }
    const m = await gphotos().getMetadata(p).catch(() => null);
    if (!m) continue;
    if (isOwner || authors.some((x) => x && m.metadata?.author === x)) ok.push(p);
  }
  return ok;
}
var gstories_default = async (req, context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const a = await accessOf(req);
  if (!a.canView) return jsonResponse({ error: a.needGuest ? "guest-login" : "link required" }, { status: 401 });
  const isOwner = a.canEdit;
  const share = isOwner ? null : await readShare(req.method !== "GET");
  if (share && !share.tabs.gstory) {
    if (req.method === "GET") return jsonResponse({ items: [], count: 0, hidden: true });
    return jsonResponse({ error: "closed" }, { status: 403 });
  }
  const token = (req.headers.get("x-author") || "").trim();
  const author = /^[A-Za-z0-9_-]{24,100}$/.test(token) ? await sha2563("gs|" + token) : "";
  const acct = a.guest ? await sha2563("gs|acct|" + a.guest.id) : "";
  const isMine = (g) => !!author && g.author === author || !!acct && g.author === acct;
  const id = context.params?.id;
  const s = store7();
  try {
    if (req.method === "GET") {
      const { blobs } = await s.list({ prefix: "s-" });
      const all = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
      const items = all.filter((g) => isOwner || isMine(g) || g.owner && g.status === "ok").map((g) => {
        const { author: _au, ...rest } = g;
        return { ...rest, mine: isMine(g) };
      }).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
      return jsonResponse({ items, count: items.length, approval: !!(share ? share.guestApproval : (await readShare(true)).guestApproval) });
    }
    if (req.method === "POST" && !id) {
      if (!isOwner && !author && !acct) return jsonResponse({ error: "author key required" }, { status: 400 });
      const body = clean(await req.json());
      if (a.guest) body.nickname = a.guest.nickname;
      body.photoIds = await ownPhotos(body.photoIds, [author, acct], isOwner);
      if (!body.nickname) return jsonResponse({ error: "nickname required" }, { status: 400 });
      if (!body.memo && !body.photoIds.length && !body.golf && !body.hike) return jsonResponse({ error: "empty" }, { status: 400 });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const approval = share ? share.guestApproval : false;
      const item = { id: crypto.randomUUID(), ...body, owner: isOwner, guestId: a.guest ? a.guest.id : null, author: acct || author || "owner", status: isOwner || !approval ? "ok" : "pending", createdAt: now, updatedAt: now };
      await s.setJSON("s-" + item.id, item);
      const { author: _x, ...out } = item;
      return jsonResponse({ item: { ...out, mine: true } }, { status: 201 });
    }
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return jsonResponse({ error: "not found" }, { status: 404 });
    const cur = await s.get("s-" + id, { type: "json" });
    if (!cur) return jsonResponse({ error: "not found" }, { status: 404 });
    const mine = isMine(cur);
    if (!isOwner && !mine) return jsonResponse({ error: "not yours" }, { status: 403 });
    if (req.method === "PUT") {
      const input = await req.json();
      let next;
      if (isOwner && typeof input?.status === "string" && Object.keys(input).length === 1) {
        if (!STATUSES.includes(input.status)) return jsonResponse({ error: "bad status" }, { status: 400 });
        next = { ...cur, status: input.status, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      } else {
        const body = clean(input);
        body.photoIds = await ownPhotos(body.photoIds, [author, acct], isOwner, cur.photoIds || []);
        if (!body.nickname || a.guest) body.nickname = a.guest ? a.guest.nickname : cur.nickname;
        const status = !isOwner && share?.guestApproval && cur.status === "ok" ? "pending" : cur.status;
        next = { ...cur, ...body, status, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
        const removed = (cur.photoIds || []).filter((p) => !body.photoIds.includes(p));
        await Promise.all(removed.map((p) => gphotos().delete(p).catch(() => {
        })));
      }
      await s.setJSON("s-" + id, next);
      const { author: _x, ...out } = next;
      return jsonResponse({ item: { ...out, mine } });
    }
    if (req.method === "DELETE") {
      await s.delete("s-" + id);
      await Promise.all((cur.photoIds || []).map((p) => gphotos().delete(p).catch(() => {
      })));
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config12 = {
  path: ["/api/gstories", "/api/gstories/:id"]
};

// ../src/lib/heritage.mts
var BASES = ["https://www.khs.go.kr/cha", "http://www.khs.go.kr/cha"];
var PAGE_UNIT = 100;
var KINDS = { "11": "\uAD6D\uBCF4", "12": "\uBCF4\uBB3C", "13": "\uC0AC\uC801", "15": "\uBA85\uC2B9", "16": "\uCC9C\uC5F0\uAE30\uB150\uBB3C" };
var AREA_TO_CTCD = {
  "1": "11",
  "2": "23",
  "3": "25",
  "4": "22",
  "5": "24",
  "6": "21",
  "7": "26",
  "8": "45",
  "31": "31",
  "32": "32",
  "33": "33",
  "34": "34",
  "35": "37",
  "36": "38",
  "37": "35",
  "38": "36",
  "39": "50"
};
var text = (v) => typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
var coord = (v) => {
  const n = Number(text(v));
  return Number.isFinite(n) && n !== 0 ? n : null;
};
var toArray = (v) => v == null || v === "" ? [] : Array.isArray(v) ? v : [v];
var httpsUrl2 = (v) => text(v).replace(/^http:\/\//i, "https://");
var cleanBody = (v) => text(v).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
async function getXml(path, params) {
  let lastErr;
  for (const base of BASES) {
    try {
      const url = new URL(`${base}/${path}`);
      for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8e3) });
      if (!res.ok) throw new Error(`heritage api http ${res.status}`);
      const body = await res.text();
      const data = await parseStringPromise(body, { explicitArray: false, ignoreAttrs: true, trim: true });
      if (!data?.result) throw new Error("heritage api: unexpected response");
      return data.result;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
function mapListItem(it, kindFallback = "") {
  return {
    id: [text(it.ccbaKdcd), text(it.ccbaAsno), text(it.ccbaCtcd)].join("-"),
    kdcd: text(it.ccbaKdcd),
    asno: text(it.ccbaAsno),
    ctcd: text(it.ccbaCtcd),
    name: text(it.ccbaMnm1),
    hanja: text(it.ccbaMnm2),
    kindName: text(it.ccmaName) || kindFallback,
    sido: text(it.ccbaCtcdNm),
    sigungu: text(it.ccsiName),
    admin: text(it.ccbaAdmin),
    lat: coord(it.latitude),
    lng: coord(it.longitude)
  };
}
async function searchHeritage(q, max = 30) {
  const result = await getXml("SearchKindOpenapiList.do", { pageUnit: String(max), pageIndex: "1", ccbaMnm1: q, ccbaCncl: "N" });
  return toArray(result.item).map((it) => mapListItem(it)).filter((it) => it.name);
}
async function fetchHeritageList(opts) {
  const kind = KINDS[opts.kind || ""] ? opts.kind : "11";
  const page = Math.max(1, Math.floor(opts.page || 1));
  const result = await getXml("SearchKindOpenapiList.do", {
    pageUnit: String(PAGE_UNIT),
    pageIndex: String(page),
    ccbaKdcd: kind,
    ccbaCtcd: AREA_TO_CTCD[opts.areaCode || ""] || "",
    ccbaCncl: "N"
    // 지정 해제된 것은 제외
  });
  const rawItems = toArray(result.item);
  const items = rawItems.map((it) => mapListItem(it, KINDS[kind])).filter((it) => it.name);
  const total = Number(text(result.totalCnt)) || items.length;
  const out = { items, total, page, pageUnit: PAGE_UNIT, kind, kindName: KINDS[kind] };
  if (opts.debug) out.debug = { resultKeys: Object.keys(result), rawCount: rawItems.length, firstRaw: rawItems[0] || null };
  return out;
}
var WHOLE_RE = /(전경|전체|원경|정면|측면|모습|외관|항공|드론|국립문화유산연구원|풍경|경관)/;
var PART_RE = /(기단|상륜|탑신|옥개|팔부|중상|사천왕|세부|부분|문양|올려|내려다|명문|현판|글씨|도면|실측|탁본|확대|근경|조각|감실|내부|천장|기와|단청|장식|부재|초석|평면|배치도)/;
var NURI = { A: "\uACF5\uACF5\uB204\uB9AC \uC81C1\uC720\uD615", B: "\uACF5\uACF5\uB204\uB9AC \uC81C2\uC720\uD615", C: "\uACF5\uACF5\uB204\uB9AC \uC81C3\uC720\uD615", D: "\uACF5\uACF5\uB204\uB9AC \uC81C4\uC720\uD615", E: "\uACF5\uACF5\uB204\uB9AC \uC81C0\uC720\uD615" };
function nuriLabel(code) {
  const first = String(code || "").split("/")[0].trim().toUpperCase();
  return NURI[first] || "";
}
function pickWholePhotos(list, max = 5) {
  const seen = /* @__PURE__ */ new Set();
  const uniq = list.filter((p) => p.url && !seen.has(p.url) && seen.add(p.url));
  const scored = uniq.map((p, i) => {
    let score = 0;
    if (WHOLE_RE.test(p.desc)) score += 3;
    if (PART_RE.test(p.desc)) score -= 5;
    return { ...p, score, i };
  });
  const good = scored.filter((p) => p.score >= 0).sort((a, b) => b.score - a.score || a.i - b.i);
  return good.slice(0, max).map(({ url, desc, credit }) => ({ url, desc, credit: credit || "\uAD6D\uAC00\uC720\uC0B0\uCCAD" }));
}
async function fetchHeritageImages(opts) {
  try {
    const result = await getXml("SearchImageOpenapi.do", { ccbaKdcd: opts.kdcd, ccbaAsno: opts.asno, ccbaCtcd: opts.ctcd });
    const out = [];
    for (const it of toArray(result.item)) {
      const urls = toArray(it.imageUrl).map(httpsUrl2);
      const descs = toArray(it.ccimDesc).map(text);
      const nuris = toArray(it.imageNuri).map(text);
      urls.forEach((u, i) => {
        const lic = nuriLabel(nuris[i] || "");
        if (/^https:\/\//.test(u)) out.push({ url: u, desc: descs[i] || "", credit: "\uAD6D\uAC00\uC720\uC0B0\uCCAD" + (lic ? " \xB7 " + lic : "") });
      });
    }
    return out;
  } catch {
    return [];
  }
}
async function fetchHeritageDetail(opts) {
  const [result, imgs] = await Promise.all([
    getXml("SearchKindOpenapiDt.do", { ccbaKdcd: opts.kdcd, ccbaAsno: opts.asno, ccbaCtcd: opts.ctcd }),
    fetchHeritageImages(opts)
  ]);
  const it = toArray(result.item)[0] || {};
  const asdt = text(it.ccbaAsdt);
  const mainImage = httpsUrl2(it.imageUrl) || null;
  const classes = [it.gcodeName, it.bcodeName, it.mcodeName, it.scodeName].map(text).filter(Boolean);
  const images = pickWholePhotos(imgs, 5);
  if (!images.length && mainImage) images.push({ url: mainImage, desc: "", credit: "\uAD6D\uAC00\uC720\uC0B0\uCCAD" });
  const out = {
    name: text(it.ccbaMnm1),
    hanja: text(it.ccbaMnm2),
    kindName: text(it.ccmaName),
    classification: classes.join(" / "),
    address: text(it.ccbaLcad),
    era: text(it.ccceName),
    designatedAt: /^\d{8}$/.test(asdt) ? `${asdt.slice(0, 4)}.${asdt.slice(4, 6)}.${asdt.slice(6, 8)}` : asdt,
    quantity: text(it.ccbaQuan),
    owner: text(it.ccbaPoss),
    admin: text(it.ccbaAdmin),
    image: images[0]?.url || mainImage,
    images,
    content: cleanBody(it.content),
    lat: coord(result.latitude),
    lng: coord(result.longitude)
  };
  if (opts.debug) out.debug = { resultKeys: Object.keys(result), itemKeys: Object.keys(it), imageCount: imgs.length, imageSample: imgs.slice(0, 8) };
  return out;
}

// ../netlify/functions/heritage.mts
var heritage_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const q = url.searchParams;
    const debug = q.get("debug") === "1";
    if (url.pathname.endsWith("/detail")) {
      const kdcd = q.get("kdcd") || "";
      const asno = q.get("asno") || "";
      const ctcd = q.get("ctcd") || "";
      if (!/^\d{2}$/.test(kdcd) || !/^\d{1,20}$/.test(asno) || !/^[0-9A-Z]{2}$/.test(ctcd)) {
        return jsonResponse({ error: "bad request" }, { status: 400 });
      }
      const key = `heritage3-${kdcd}-${asno}-${ctcd}`;
      if (!debug) {
        const hit = await getStore("cache").get(key, { type: "json" });
        if (hit && typeof hit === "object" && hit.name) return jsonResponse({ ...hit, cached: true });
      }
      const detail = await fetchHeritageDetail({ kdcd, asno, ctcd, debug });
      if (!debug && detail.name) await getStore("cache").setJSON(key, detail);
      return jsonResponse(detail);
    }
    if (q.get("all") === "1") {
      const kind = q.get("kind") || "11";
      const areaCode = q.get("areaCode") || "";
      if (!/^\d{2}$/.test(kind) || !/^\d{1,2}$/.test(areaCode)) return jsonResponse({ error: "bad request" }, { status: 400 });
      const key = `hlist-v1-${kind}-${areaCode}`;
      const store14 = getStore("cache");
      const hit = await store14.get(key, { type: "json" });
      if (hit && Date.now() - (hit.at || 0) < 30 * 24 * 3600 * 1e3) return jsonResponse({ ...hit, cached: true });
      const first = await fetchHeritageList({ kind, areaCode, page: 1 });
      const pages = Math.min(15, Math.ceil((first.total || 0) / first.pageUnit));
      const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fetchHeritageList({ kind, areaCode, page: i + 2 }).catch(() => ({ items: [], failed: true }))));
      const failed = rest.some((r) => r.failed);
      const items = first.items.concat(...rest.map((r) => r.items)).filter((it) => it.lat != null && it.lng != null);
      const out = { at: Date.now(), kind, kindName: first.kindName, areaCode, total: first.total, items };
      if (!failed) await store14.setJSON(key, out);
      return jsonResponse(out);
    }
    const result = await fetchHeritageList({
      kind: q.get("kind") || void 0,
      areaCode: q.get("areaCode") || void 0,
      page: Number(q.get("page")) || 1,
      debug
    });
    return jsonResponse({ ...result, count: result.items.length });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 502 });
  }
};
var config13 = {
  path: ["/api/heritage", "/api/heritage/detail"]
};

// ../netlify/functions/image.mts
var FALLBACK_KEY5 = "";
var TOUR_BASE2 = "https://apis.data.go.kr/B551011/KorService2";
var GALLERY_BASE = "https://apis.data.go.kr/B551011/PhotoGalleryService1";
var cache3 = () => getStore("cache");
async function sha12(text3) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text3));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var img = (v) => typeof v === "string" && /^https?:\/\//i.test(v) ? v.replace(/^http:\/\//i, "https://") : null;
var norm2 = (s) => String(s || "").replace(/\([^)]*\)|\[[^\]]*\]/g, "").replace(/[\s·,.\-_/]/g, "").toLowerCase();
var okCode = (c) => c === "0000" || c === "00";
var image_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const params = new URL(req.url).searchParams;
    const name = (params.get("q") || "").replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
    const mine = params.get("src") === "mine";
    const debug = params.get("debug") === "1";
    if (name.length < 2) return jsonResponse({ error: "bad query" }, { status: 400 });
    const key = Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY5;
    const hash2 = await sha12(name);
    const dbg = {};
    if (mine) {
      const tKey = `imgT-${hash2}`;
      let t = debug ? null : await cache3().get(tKey, { type: "json" });
      if (!t) {
        const r = await callGovApi(TOUR_BASE2, "searchKeyword2", key, { keyword: name, numOfRows: 10 });
        dbg.tour = { resultCode: r.resultCode, resultMsg: r.resultMsg, count: r.items.length, first: r.items[0] || null };
        if (okCode(r.resultCode) || r.items.length) {
          const n = norm2(name);
          const hit = r.items.find((it) => img(it.firstimage) && (norm2(it.title).includes(n) || n.includes(norm2(it.title))));
          t = { image: hit ? img(hit.firstimage) : null };
          if (!debug) await cache3().setJSON(tKey, t);
        }
      }
      if (t?.image) return jsonResponse({ image: t.image, source: "\uD55C\uAD6D\uAD00\uAD11\uACF5\uC0AC", ...debug ? { debug: dbg } : {} });
    }
    const gKey = `imgG2-${hash2}`;
    let g = debug ? null : await cache3().get(gKey, { type: "json" });
    let galleryOff = false;
    if (!g) {
      const r = await callGovApi(GALLERY_BASE, "gallerySearchList1", key, { keyword: name, numOfRows: 10, arrange: "A" });
      dbg.gallery = { resultCode: r.resultCode, resultMsg: r.resultMsg, count: r.items.length, first: r.items[0] || null };
      if (okCode(r.resultCode) || r.items.length) {
        const n = norm2(name);
        const hit = r.items.find((it) => img(it.galWebImageUrl) && norm2(it.galTitle).length >= 2 && (norm2(it.galTitle).includes(n) || n.includes(norm2(it.galTitle))));
        g = { image: hit ? img(hit.galWebImageUrl) : null, title: hit?.galTitle || "", photographer: hit?.galPhotographer || "" };
        if (!debug) await cache3().setJSON(gKey, g);
      } else {
        galleryOff = true;
      }
    }
    return jsonResponse({
      image: g?.image || null,
      source: g?.image ? "\uD55C\uAD6D\uAD00\uAD11\uACF5\uC0AC \uAD00\uAD11\uC0AC\uC9C4" : null,
      title: g?.title || "",
      photographer: g?.photographer || "",
      ...galleryOff ? { galleryOff: true } : {},
      ...debug ? { debug: dbg } : {}
    });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 502 });
  }
};
var config14 = {
  path: "/api/image"
};

// ../netlify/functions/mapconfig.mts
var mapconfig_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const kakaoKey = (Netlify.env.get("KAKAO_JS_KEY") || Netlify.env.get("kakao_js_key") || "").trim();
  return jsonResponse({ provider: kakaoKey ? "kakao" : "naver", kakaoKey: kakaoKey || null }, { headers: { "Cache-Control": "no-store" } });
};
var config15 = {
  path: "/api/mapconfig"
};

// ../netlify/functions/mapsearch.mts
var FALLBACK_KEY6 = "";
var TOUR_BASE3 = "https://apis.data.go.kr/B551011/KorService2";
var DAY = 24 * 60 * 60 * 1e3;
async function sha13(text3) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text3));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var dashed = (v) => {
  const s = String(v ?? "");
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
};
var CAT = { "12": "\uBA85\uC18C", "14": "\uBA85\uC18C", "28": "\uBA85\uC18C", "39": "\uB9DB\uC9D1", "15": "\uD589\uC0AC" };
var mapsearch_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const q = (new URL(req.url).searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 30);
  if (q.length < 2) return jsonResponse({ error: "bad query" }, { status: 400 });
  const store14 = getStore("cache");
  const cKey = `msearch-v1-${await sha13(q)}`;
  const hit = await store14.get(cKey, { type: "json" });
  if (hit && Date.now() - (hit.at || 0) < DAY) return jsonResponse({ ...hit, cached: true });
  const key = Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY6;
  const [h, t] = await Promise.allSettled([
    searchHeritage(q, 30),
    callGovApi(TOUR_BASE3, "searchKeyword2", key, { keyword: q, numOfRows: 40, arrange: "A" })
  ]);
  const heritage = h.status === "fulfilled" ? h.value.filter((it) => it.lat != null && it.lng != null) : [];
  const tour = t.status === "fulfilled" ? t.value.items.filter((it) => CAT[String(it.contenttypeid)] && Number(it.mapy) > 32 && Number(it.mapx) > 124).map((it) => {
    const cat = CAT[String(it.contenttypeid)];
    const address = it.addr1 || it.addr2 || "";
    const base = { id: String(it.contentid), ctype: String(it.contenttypeid), name: String(it.title || ""), address, mapX: Number(it.mapx), mapY: Number(it.mapy), image: it.firstimage || null, tel: it.tel || null, overview: null };
    return { cat, item: cat === "\uD589\uC0AC" ? { ...base, place: address, startDate: dashed(it.eventstartdate), endDate: dashed(it.eventenddate) } : { ...base, type: cat === "\uB9DB\uC9D1" ? "restaurant" : "attraction" } };
  }) : [];
  const out = { at: Date.now(), q, heritage, tour, errors: [h, t].filter((r) => r.status === "rejected").length };
  if (!out.errors) await store14.setJSON(cKey, out);
  return jsonResponse(out);
};
var config16 = {
  path: "/api/mapsearch"
};

// ../netlify/functions/marks.mts
var KEY4 = "all";
var store8 = () => getStore({ name: "marks", consistency: "strong" });
var KEY_RE3 = /^[a-z]:[A-Za-z0-9_\-.:]{1,100}$/;
async function readAll3() {
  const data = await store8().get(KEY4, { type: "json" });
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}
var marks_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    if (req.method === "GET") {
      const share = await viewerShare(req);
      if (share && !share.marks) return jsonResponse({ items: {}, count: 0, hidden: true });
      const items = await readAll3();
      return jsonResponse({ items, count: Object.keys(items).length });
    }
    if (req.method === "PUT") {
      const body = await req.json();
      const key = typeof body?.key === "string" ? body.key : "";
      if (!KEY_RE3.test(key)) return jsonResponse({ error: "bad key" }, { status: 400 });
      const visited = body?.visited === true;
      const date = visited && typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
      const r = Math.round(Number(body?.rating));
      const rating = Number.isFinite(r) ? Math.min(5, Math.max(0, r)) : 0;
      const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1e3) : "";
      const items = await readAll3();
      if (!visited && !rating && !note) delete items[key];
      else items[key] = { visited, date, rating, note, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await store8().setJSON(KEY4, items);
      return jsonResponse({ ok: true, item: items[key] || null });
    }
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config17 = {
  path: "/api/marks"
};

// ../netlify/functions/mtnpaths.mts
var API = "https://api.vworld.kr/req/data";
var DOMAIN = "travel-story.hongtravel7584.workers.dev";
var TTL_MS5 = 30 * 24 * 60 * 60 * 1e3;
var MAX_LINES = 400;
var MAX_PTS_PER_LINE = 120;
var r53 = (v) => Math.round(v * 1e5) / 1e5;
function thin2(line) {
  if (line.length <= MAX_PTS_PER_LINE) return line;
  const out = [];
  const step = (line.length - 1) / (MAX_PTS_PER_LINE - 1);
  for (let i = 0; i < MAX_PTS_PER_LINE; i++) out.push(line[Math.round(i * step)]);
  return out;
}
var num5 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
var mtnpaths_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const key = Netlify.env.get("VWORLD_KEY") || "";
  if (!key) return jsonResponse({ configured: false, lines: [] });
  const q = new URL(req.url).searchParams;
  if (q.get("key") === "1") return jsonResponse({ configured: true, key, domain: DOMAIN }, { headers: { "Cache-Control": "no-store" } });
  const s = num5(q.get("s")), w = num5(q.get("w")), n = num5(q.get("n")), e = num5(q.get("e"));
  const debug = q.get("debug") === "1";
  if (s == null || w == null || n == null || e == null || !(s < n && w < e) || n - s > 0.4 || e - w > 0.5 || s < 32 || n > 39 || w < 124 || e > 132.5) {
    return jsonResponse({ error: "bad box" }, { status: 400 });
  }
  const box = [w, s, e, n].map((v) => v.toFixed(3));
  const cKey = `vwpath-v1-${box.join("_")}`;
  const store14 = getStore("cache");
  if (!debug) {
    const hit = await store14.get(cKey, { type: "json" });
    if (hit && Date.now() - (hit.at || 0) < TTL_MS5) return jsonResponse({ ...hit, cached: true });
  }
  try {
    const lines = [];
    let total = 0;
    let sample = null;
    for (let page = 1; page <= 4 && lines.length < MAX_LINES; page++) {
      const url = `${API}?service=data&request=GetFeature&data=LT_L_FRSTCLIMB&format=json&geometry=true&attribute=true&crs=EPSG:4326&size=1000&page=${page}&geomFilter=BOX(${box.join(",")})&key=${encodeURIComponent(key)}&domain=${encodeURIComponent(DOMAIN)}`;
      let res, text3 = "";
      for (let tryNo = 0; ; tryNo++) {
        res = await fetch(url, { signal: AbortSignal.timeout(12e3), headers: { Referer: `https://${DOMAIN}/` } });
        text3 = await res.text();
        if (tryNo >= 1 || res.status < 500 && text3.trim().startsWith("{")) break;
        await new Promise((r2) => setTimeout(r2, 600));
      }
      let data;
      try {
        data = JSON.parse(text3);
      } catch {
        throw new Error(`vworld not json (${res.status}) ${text3.slice(0, 160)}`);
      }
      const r = data?.response || {};
      if (r.status === "NOT_FOUND") break;
      if (r.status !== "OK") {
        const code = r.error?.code || r.status || res.status;
        return jsonResponse({ error: "vworld", code, message: r.error?.text || "" }, { status: 502 });
      }
      const feats = r.result?.featureCollection?.features || [];
      if (!sample && feats[0]) sample = { properties: feats[0].properties, geometryType: feats[0].geometry?.type };
      total = Number(r.record?.total) || Number(r.page?.total) || total;
      for (const f of feats) {
        const g = f?.geometry || {};
        const parts = g.type === "MultiLineString" ? g.coordinates : g.type === "LineString" ? [g.coordinates] : [];
        const p = f?.properties || {};
        for (const part of parts) {
          if (!Array.isArray(part) || part.length < 2) continue;
          const c = thin2(part.map((xy) => [r53(Number(xy[1])), r53(Number(xy[0]))]).filter((x) => x[0] > 32 && x[1] > 124));
          if (c.length >= 2) lines.push({ c, name: String(p.mntn_nm || ""), min: num5(p.up_min), level: String(p.cat_nam || "") });
          if (lines.length >= MAX_LINES) break;
        }
      }
      const pages = Number(r.page?.total) || 1;
      if (page >= pages) break;
    }
    const out = { at: Date.now(), configured: true, total, lines };
    if (!debug) await store14.setJSON(cKey, out);
    return jsonResponse(debug ? { ...out, sample } : out);
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 502 });
  }
};
var config18 = {
  path: "/api/mtnpaths"
};

// ../netlify/functions/mtntrail.mts
var FALLBACK_KEY7 = "";
var API2 = "https://apis.data.go.kr/B553662/frtrlRdsfInfoService/getFrtrlRdsfInfoList";
var DATASET2 = { name: "\uD55C\uAD6D\uB4F1\uC0B0\uD2B8\uB808\uD0B9\uC9C0\uC6D0\uC13C\uD130_100\uB300\uBA85\uC0B0 \uC232\uAE38\uB178\uBA74\uC815\uBCF4 \uC11C\uBE44\uC2A4", page: "https://www.data.go.kr/data/15097960/openapi.do" };
var TTL_MS6 = 30 * 24 * 60 * 60 * 1e3;
var MAX_PTS = 400;
function km2(a, b) {
  const R = 6371, t = Math.PI / 180;
  const x = Math.sin((b[0] - a[0]) * t / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin((b[1] - a[1]) * t / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
var pathLen = (pts) => pts.reduce((s, p, i) => i ? s + km2(pts[i - 1], p) : 0, 0);
var GAP_KM = 0.3;
function splitAtGaps(pts) {
  const parts = [];
  let cur = [];
  for (const p of pts) {
    if (cur.length && km2(cur[cur.length - 1], p) > GAP_KM) {
      if (cur.length >= 2) parts.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length >= 2) parts.push(cur);
  return parts;
}
function orderPoints(pts) {
  if (pts.length < 3) return pts;
  const given = pathLen(pts);
  const rest = pts.slice();
  let start = 0, far = -1;
  for (let i = 0; i < rest.length; i++) {
    const d = km2(rest[i], rest[0]);
    if (d > far) {
      far = d;
      start = i;
    }
  }
  const out = [rest.splice(start, 1)[0]];
  while (rest.length) {
    const last = out[out.length - 1];
    let bi = 0, bd = Infinity;
    for (let i = 0; i < rest.length; i++) {
      const d = km2(last, rest[i]);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    out.push(rest.splice(bi, 1)[0]);
  }
  return pathLen(out) * 1.3 < given ? out : pts;
}
function thin3(pts) {
  if (pts.length <= MAX_PTS) return pts;
  const step = pts.length / MAX_PTS;
  const out = [];
  for (let i = 0; i < MAX_PTS; i++) out.push(pts[Math.floor(i * step)]);
  out.push(pts[pts.length - 1]);
  return out;
}
var norm3 = (s) => String(s ?? "").replace(/\s+|\(.*?\)/g, "");
function looksUnregistered2(status, text3) {
  return status === 401 || status === 403 || /SERVICE_KEY_IS_NOT_REGISTERED|SERVICE_ACCESS_DENIED|"returnReasonCode"\s*:\s*"(30|20)"|<returnReasonCode>\s*(30|20)\s*</i.test(text3);
}
var UpstreamTimeout = class extends Error {
};
async function fetchPage(name, key, page) {
  const url = `${API2}?serviceKey=${encodeURIComponent(key)}&pageNo=${page}&numOfRows=1000&type=json&srchFrtrlNm=${encodeURIComponent(name)}`;
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(attempt ? 1e4 : 9e3) });
      return { status: res.status, text: await res.text() };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new UpstreamTimeout(lastErr?.message || "timeout");
}
function parsePage(status, text3) {
  let data;
  try {
    data = JSON.parse(text3);
  } catch {
    throw new Error(`not json (${status}) ${text3.slice(0, 160)}`);
  }
  const root = data?.response || data || {};
  const code = String(root?.header?.resultCode ?? "");
  if (code && code !== "0" && code !== "00" && code !== "0000" && code !== "03") throw new Error(`${code} ${root?.header?.resultMsg || ""}`);
  const body = root.body || {};
  let items = body.items;
  if (items && !Array.isArray(items)) items = Array.isArray(items.item) ? items.item : items.item ? [items.item] : [];
  return { items: items || [], total: Number(body.totalCount) || 0 };
}
async function fetchAll(name, key) {
  const rows = [];
  const first = await fetchPage(name, key, 1);
  if (looksUnregistered2(first.status, first.text)) return { needApply: true, rows };
  const p1 = parsePage(first.status, first.text);
  rows.push(...p1.items);
  const pages = Math.min(30, Math.ceil((p1.total || rows.length) / 1e3));
  if (p1.items.length && pages > 1) {
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => fetchPage(name, key, i + 2)));
    for (const r of rest) {
      if (looksUnregistered2(r.status, r.text)) return { needApply: true, rows };
      rows.push(...parsePage(r.status, r.text).items);
    }
  }
  return { needApply: false, rows };
}
var mtntrail_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const name = (q.get("name") || "").replace(/\s+/g, " ").trim().slice(0, 30);
  const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
  const hasLL = Number.isFinite(lat) && Number.isFinite(lng) && lat > 32 && lng > 124;
  const debug = q.get("debug") === "1";
  if (name.length < 2) return jsonResponse({ error: "bad name" }, { status: 400 });
  const store14 = getStore("cache");
  const cKey = `mtrail-v2-${norm3(name)}`;
  if (!debug) {
    const hit = await store14.get(cKey, { type: "json" });
    if (hit && Date.now() - (hit.at || 0) < TTL_MS6) return jsonResponse({ ...hit, cached: true });
  }
  try {
    const key = Netlify.env.get("FOREST_API_KEY") || Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY7;
    const r = await fetchAll(name, key);
    if (r.needApply) return jsonResponse({ error: "need-apply", apply: [DATASET2] }, { status: 503 });
    let rows = r.rows.filter((it) => norm3(it.frtrlNm) === norm3(name));
    if (!rows.length) rows = r.rows;
    const groups = /* @__PURE__ */ new Map();
    for (const it of rows) {
      const p = [Number(it.lat), Number(it.lot ?? it.lon ?? it.lng), Number(it.aslAltide) || 0];
      if (!(p[0] > 32 && p[0] < 39 && p[1] > 124 && p[1] < 132)) continue;
      if (hasLL && km2(p, [lat, lng, 0]) > 25) continue;
      const id = String(it.crseId || it.frtrlId || "0");
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(p);
    }
    const courses = Array.from(groups.entries()).map(([id, pts]) => {
      const ordered = orderPoints(pts);
      const alts = ordered.map((p) => p[2]).filter((a) => a > 0);
      const parts = splitAtGaps(ordered);
      const total = parts.reduce((s, q2) => s + pathLen(q2), 0);
      const keep = Math.max(2, Math.floor(MAX_PTS / Math.max(1, parts.length)));
      const r55 = (p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5];
      const thinTo = (q2) => q2.length <= keep ? q2 : Array.from({ length: keep }, (_, i) => q2[Math.floor(i * (q2.length - 1) / (keep - 1))]);
      return {
        id,
        km: Math.round(total * 10) / 10,
        minAlt: alts.length ? Math.round(Math.min(...alts)) : null,
        maxAlt: alts.length ? Math.round(Math.max(...alts)) : null,
        points: thin3(ordered).map(r55),
        parts: parts.map((q2) => thinTo(q2).map(r55))
      };
    }).filter((c) => c.points.length >= 2 && c.km >= 0.2).sort((a, b) => b.km - a.km).slice(0, 12);
    const out = { at: Date.now(), name, courses, rawCount: r.rows.length };
    if (!debug && r.rows.length) await store14.setJSON(cKey, out);
    return jsonResponse(debug ? { ...out, sample: r.rows.slice(0, 3) } : out);
  } catch (err) {
    if (err instanceof UpstreamTimeout) return jsonResponse({ error: "upstream-timeout" }, { status: 504 });
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 502 });
  }
};
var config19 = {
  path: "/api/mtntrail"
};

// ../netlify/functions/mtninfo.mts
var FALLBACK_KEY8 = "";
var API3 = "https://apis.data.go.kr/1400000/trailInfoService/getforeststoryservice";
var DATASET3 = { name: "\uC0B0\uB9BC\uCCAD_\uC0B0 \uC815\uBCF4 \uC870\uD68C_GW", page: "https://www.data.go.kr/data/15158978/openapi.do" };
var TTL_MS7 = 30 * 24 * 60 * 60 * 1e3;
var ENT2 = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", middot: "\xB7", ordf: "", ucirc: "", hellip: "\u2026", lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201C", rdquo: "\u201D", ndash: "\u2013", mdash: "\u2014" };
var decode = (t) => t.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&([a-z]+);/gi, (_, n) => ENT2[n.toLowerCase()] ?? "");
var clean2 = (v) => decode(decode(String(v ?? ""))).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/[ \t\u00a0]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
var norm4 = (s) => String(s ?? "").replace(/\s+|\(.*?\)/g, "");
var SIDO = { \uACBD\uBD81: "\uACBD\uC0C1\uBD81\uB3C4", \uACBD\uB0A8: "\uACBD\uC0C1\uB0A8\uB3C4", \uC804\uBD81: "\uC804\uBD81", \uC804\uB0A8: "\uC804\uB77C\uB0A8\uB3C4", \uCDA9\uBD81: "\uCDA9\uCCAD\uBD81\uB3C4", \uCDA9\uB0A8: "\uCDA9\uCCAD\uB0A8\uB3C4", \uAC15\uC6D0: "\uAC15\uC6D0", \uACBD\uAE30: "\uACBD\uAE30", \uC11C\uC6B8: "\uC11C\uC6B8", \uBD80\uC0B0: "\uBD80\uC0B0", \uB300\uAD6C: "\uB300\uAD6C", \uC778\uCC9C: "\uC778\uCC9C", \uAD11\uC8FC: "\uAD11\uC8FC", \uB300\uC804: "\uB300\uC804", \uC6B8\uC0B0: "\uC6B8\uC0B0", \uC81C\uC8FC: "\uC81C\uC8FC" };
function pick(it, ...keys) {
  for (const k of keys) {
    const v = clean2(it[k]);
    if (v && v !== "null") return v;
  }
  return "";
}
function lower(it) {
  const o = {};
  for (const [k, v] of Object.entries(it || {})) o[k.toLowerCase()] = typeof v === "object" ? "" : v;
  return o;
}
function shape(raw) {
  const it = lower(raw);
  const h = Number(String(pick(it, "mntninfohght", "mntnhght")).replace(/[^\d.]/g, ""));
  return {
    id: pick(it, "mntnid"),
    name: pick(it, "mntnnm"),
    sub: pick(it, "mntnsbttlinfo"),
    height: Number.isFinite(h) && h > 0 ? Math.round(h) : null,
    addr: pick(it, "mntninfopoflc", "mntnadd"),
    manage: pick(it, "mntninfomngmemnbdnm"),
    desc: pick(it, "mntninfodtlinfocont"),
    story: pick(it, "mntninfodscrt"),
    reason: pick(it, "hndfmsmtnslctnrson"),
    course: pick(it, "crcmrsghtnginfoetcdscrt", "ptmntrcmmncoursdscrt"),
    etc: pick(it, "crcmrsghtnginfodscrt"),
    transit: pick(it, "pbtrninfodscrt")
  };
}
async function search(name, key) {
  const url = `${API3}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=50&mntnNm=${encodeURIComponent(name)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12e3) });
  const text3 = await res.text();
  if (res.status === 401 || res.status === 403 || /SERVICE_KEY_IS_NOT_REGISTERED|SERVICE_ACCESS_DENIED|<returnReasonCode>\s*(30|20)\s*</i.test(text3)) return { needApply: true, items: [] };
  let data;
  try {
    data = JSON.parse(text3);
  } catch {
    data = await parseStringPromise(text3, { explicitArray: false, ignoreAttrs: true, trim: true });
  }
  const root = data?.response || data || {};
  const code = String(root?.header?.resultCode ?? "");
  if (code && !/^0+$/.test(code) && code !== "03") throw new Error(`${code} ${root?.header?.resultMsg || ""}`);
  let items = root?.body?.items;
  if (items && !Array.isArray(items)) items = Array.isArray(items.item) ? items.item : items.item ? [items.item] : [];
  return { needApply: false, items: items || [] };
}
var mtninfo_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const name = (q.get("name") || "").replace(/\s+/g, " ").trim().slice(0, 30);
  const h = Number(q.get("h"));
  const near = (q.get("near") || "").slice(0, 40);
  const debug = q.get("debug") === "1";
  if (name.length < 2) return jsonResponse({ error: "bad name" }, { status: 400 });
  const store14 = getStore("cache");
  const cKey = `mtninfo-v2-${norm4(name)}`;
  let list = null;
  if (!debug) {
    const hit = await store14.get(cKey, { type: "json" });
    if (hit && Date.now() - (hit.at || 0) < TTL_MS7) list = hit.list;
  }
  let raw = [];
  if (!list) {
    try {
      const key = Netlify.env.get("FOREST_API_KEY") || Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY8;
      const r = await search(name, key);
      if (r.needApply) return jsonResponse({ error: "need-apply", apply: [DATASET3] }, { status: 503 });
      raw = r.items;
      list = r.items.map(shape).filter((x) => x.name);
      await store14.setJSON(cKey, { at: Date.now(), list });
    } catch (e) {
      return jsonResponse({ error: String(e?.message || e).slice(0, 200) }, { status: 502 });
    }
  }
  const n0 = norm4(name);
  const words = near.split(/\s+/).filter((w) => w.length >= 2).map((w) => SIDO[w.slice(0, 2)] && w.length <= 3 ? SIDO[w.slice(0, 2)] : w.replace(/(특별자치도|특별자치시|광역시|특별시|시|군|구)$/, "").slice(0, 2));
  const scored = (list || []).map((x) => {
    let s = 0;
    if (norm4(x.name) === n0) s += 100;
    else if (norm4(x.name).includes(n0)) s += 40;
    if (Number.isFinite(h) && h > 0 && x.height) s += Math.max(0, 40 - Math.abs(x.height - h) / 5);
    for (const w of words) if (x.addr.includes(w)) s += 15;
    return { x, s };
  }).sort((a, b) => b.s - a.s);
  const best = scored[0] && scored[0].s >= 40 ? scored[0].x : null;
  return jsonResponse({ found: !!best, item: best, others: scored.length - (best ? 1 : 0), source: DATASET3.name, ...debug ? { raw: raw.slice(0, 3), list } : {} });
};
var config20 = { path: "/api/mtninfo" };

// ../netlify/functions/myplaces.mts
var KEY5 = "all";
var store9 = () => getStore({ name: "myplaces", consistency: "strong" });
var str5 = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
var num6 = (v) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
var myplaces_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    if (req.method === "GET") {
      const share = await viewerShare(req);
      if (share && !share.tabs.mine) return jsonResponse({ items: [], count: 0, updatedAt: null, hidden: true });
      const data = await store9().get(KEY5, { type: "json" });
      const items = Array.isArray(data?.items) ? data.items : [];
      return jsonResponse({ items, count: items.length, updatedAt: data?.updatedAt || null });
    }
    if (req.method === "PUT") {
      const body = await req.json();
      if (!Array.isArray(body?.items)) return jsonResponse({ error: "items must be an array" }, { status: 400 });
      const items = body.items.slice(0, 5e3).map((p, i) => ({
        id: str5(p?.id, 100) || `p${i + 1}`,
        name: str5(p?.name, 200),
        address: str5(p?.address, 300),
        list: str5(p?.list, 100),
        category: str5(p?.category, 60),
        memo: str5(p?.memo, 2e3),
        url: str5(p?.url, 500),
        lat: num6(p?.lat),
        lng: num6(p?.lng)
      })).filter((p) => p.name);
      const updatedAt = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      await store9().setJSON(KEY5, { items, updatedAt });
      return jsonResponse({ ok: true, count: items.length, updatedAt });
    }
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config21 = {
  path: "/api/myplaces"
};

// ../netlify/functions/nearby.mts
var FALLBACK_KEY9 = "";
var TOUR_BASE4 = "https://apis.data.go.kr/B551011/KorService2";
var RADIUS_KM = 50;
var TTL_MS8 = 12 * 60 * 60 * 1e3;
var ATTR_TYPES = /* @__PURE__ */ new Set(["12", "14", "28"]);
var r54 = (v) => Math.round(v * 1e5) / 1e5;
function km3(a, b) {
  const R = 6371, t = Math.PI / 180;
  const x = Math.sin((b[0] - a[0]) * t / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin((b[1] - a[1]) * t / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function today() {
  const d = new Date(Date.now() + 9 * 3600 * 1e3);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
var dashed2 = (v) => {
  const s = String(v ?? "");
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
};
function centers(lat, lng) {
  const out = [[lat, lng]];
  const dLat = 30 / 111;
  const dLng = 30 / (111 * Math.cos(lat * Math.PI / 180));
  for (let i = 0; i < 6; i++) {
    const a = i * 60 * Math.PI / 180;
    out.push([lat + dLat * Math.cos(a), lng + dLng * Math.sin(a)]);
  }
  return out;
}
var nearby_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
  if (!(lat > 32 && lat < 39 && lng > 124 && lng < 132.5)) return jsonResponse({ error: "bad point" }, { status: 400 });
  const cell = [Math.round(lat * 20) / 20, Math.round(lng * 20) / 20];
  const cKey = `nearby-v1-${cell[0].toFixed(2)}_${cell[1].toFixed(2)}-${today()}`;
  const store14 = getStore("cache");
  const hit = await store14.get(cKey, { type: "json" });
  if (hit && Date.now() - (hit.at || 0) < TTL_MS8) return jsonResponse({ ...hit, cached: true });
  const key = Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY9;
  const pts = centers(cell[0], cell[1]);
  const calls = [];
  for (const [y, x] of pts) {
    calls.push(callGovApi(TOUR_BASE4, "locationBasedList2", key, { mapX: x.toFixed(6), mapY: y.toFixed(6), radius: 2e4, arrange: "E", contentTypeId: 12, numOfRows: 150 }));
    calls.push(callGovApi(TOUR_BASE4, "locationBasedList2", key, { mapX: x.toFixed(6), mapY: y.toFixed(6), radius: 2e4, arrange: "E", contentTypeId: 14, numOfRows: 40 }));
    calls.push(callGovApi(TOUR_BASE4, "locationBasedList2", key, { mapX: x.toFixed(6), mapY: y.toFixed(6), radius: 2e4, arrange: "E", contentTypeId: 39, numOfRows: 100 }));
  }
  calls.push(callGovApi(TOUR_BASE4, "searchFestival2", key, { eventStartDate: today(), numOfRows: 2e3 }));
  const res = await Promise.allSettled(calls);
  const seen = /* @__PURE__ */ new Set();
  const attractions = [], restaurants = [], festivals = [];
  let failed = 0;
  res.forEach((r) => {
    if (r.status !== "fulfilled") {
      failed++;
      return;
    }
    for (const it of r.value.items || []) {
      const y = Number(it.mapy), x = Number(it.mapx);
      if (!(y > 32 && x > 124)) continue;
      const d = km3([lat, lng], [y, x]);
      if (d > RADIUS_KM) continue;
      const id = String(it.contentid);
      const t = String(it.contenttypeid);
      if (seen.has(id)) continue;
      seen.add(id);
      const base = { id, name: String(it.title || ""), address: it.addr1 || it.addr2 || "", mapX: r54(x), mapY: r54(y), image: it.firstimage || null, tel: it.tel || null, overview: null, dist: Math.round(d * 10) / 10 };
      if (t === "15") festivals.push({ ...base, place: base.address, startDate: dashed2(it.eventstartdate), endDate: dashed2(it.eventenddate), organizer: null, homepage: null });
      else if (t === "39") restaurants.push({ ...base, type: "restaurant", areaCode: it.areacode });
      else if (ATTR_TYPES.has(t)) attractions.push({ ...base, type: "attraction", areaCode: it.areacode, ctype: t });
    }
  });
  const byDist = (a, b) => a.dist - b.dist;
  attractions.sort(byDist);
  restaurants.sort(byDist);
  festivals.sort(byDist);
  const out = { at: Date.now(), lat, lng, radiusKm: RADIUS_KM, attractions, restaurants, festivals, failed };
  if (!failed) await store14.setJSON(cKey, out);
  return jsonResponse(out);
};
var config22 = {
  path: "/api/nearby"
};

// ../netlify/functions/photos.mts
var EXT2 = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
var TYPE2 = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
var ID_RE2 = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;
var MAX_BYTES2 = 5 * 1024 * 1024;
var photos3 = () => getStore({ name: "photos", consistency: "strong" });
var MAX_THUMB2 = 600 * 1024;
var tkey2 = (id) => id.replace(/\.[a-z]+$/, "") + ".t.jpg";
var photos_default = async (req, context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const id = context.params?.id;
  const url = new URL(req.url);
  const wantThumb = url.searchParams.get("t") === "1";
  try {
    if (req.method === "POST" && id && wantThumb) {
      if (!ID_RE2.test(id)) return jsonResponse({ error: "not found" }, { status: 404 });
      if (!await photos3().getMetadata(id)) return jsonResponse({ error: "not found" }, { status: 404 });
      const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (type !== "image/jpeg") return jsonResponse({ error: "unsupported image type" }, { status: 415 });
      const body = await req.arrayBuffer();
      if (!body.byteLength || body.byteLength > MAX_THUMB2) return jsonResponse({ error: "bad thumbnail size" }, { status: 413 });
      await photos3().set(tkey2(id), body);
      return jsonResponse({ ok: true }, { status: 201 });
    }
    if (req.method === "GET" && !id && url.searchParams.get("need") != null) {
      if (!(await accessOf(req)).canEdit) return jsonResponse({ error: "forbidden" }, { status: 403 });
      const ids = url.searchParams.get("need").split(",").filter((x) => ID_RE2.test(x)).slice(0, 60);
      const need = [];
      for (const x of ids) {
        if (!await photos3().getMetadata(tkey2(x))) need.push(x);
      }
      return jsonResponse({ need }, { headers: { "Cache-Control": "no-store" } });
    }
    if (req.method === "POST" && !id) {
      const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const ext = EXT2[type];
      if (!ext) return jsonResponse({ error: "unsupported image type" }, { status: 415 });
      const body = await req.arrayBuffer();
      if (!body.byteLength) return jsonResponse({ error: "empty body" }, { status: 400 });
      if (body.byteLength > MAX_BYTES2) return jsonResponse({ error: "image too large" }, { status: 413 });
      const newId = `${crypto.randomUUID()}.${ext}`;
      await photos3().set(newId, body);
      return jsonResponse({ id: newId }, { status: 201 });
    }
    if (req.method === "GET" && id) {
      if (!ID_RE2.test(id)) return jsonResponse({ error: "not found" }, { status: 404 });
      const share = await viewerShare(req);
      if (share && (share.hiddenStories.length || !share.tabs.feed)) {
        const all = await getStore({ name: "stories", consistency: "strong" }).get("all", { type: "json" });
        const owner = (Array.isArray(all) ? all : []).find((s) => (Array.isArray(s.photoIds) ? s.photoIds : [s.photoId]).includes(id));
        if (owner && (!share.tabs.feed || share.hiddenStories.includes(String(owner.id)))) {
          return jsonResponse({ error: "not found" }, { status: 404 });
        }
      }
      if (wantThumb) {
        const th = await photos3().get(tkey2(id), { type: "arrayBuffer" });
        if (th) return new Response(th, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000, immutable", "x-thumb": "yes" } });
        const orig = await photos3().get(id, { type: "arrayBuffer" });
        if (!orig) return jsonResponse({ error: "not found" }, { status: 404 });
        return new Response(orig, { headers: { "content-type": TYPE2[id.split(".").pop()], "cache-control": "private, max-age=600", "x-thumb": "no" } });
      }
      const data = await photos3().get(id, { type: "arrayBuffer" });
      if (!data) return jsonResponse({ error: "not found" }, { status: 404 });
      return new Response(data, {
        headers: {
          "content-type": TYPE2[id.split(".").pop()],
          "cache-control": "private, max-age=31536000, immutable"
        }
      });
    }
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config23 = {
  path: ["/api/photos", "/api/photos/:id"]
};

// ../netlify/functions/picks.mts
var store10 = () => getStore({ name: "picks", consistency: "strong" });
var gphotos2 = () => getStore({ name: "gphotos", consistency: "strong" });
var PHOTO_RE4 = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
var MAX_PHOTOS2 = 5;
var STATUSES2 = ["ok", "pending", "hidden"];
var YT_RE = /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=[\w-]{6,20}([&#][\w=&%-]*)?|shorts\/[\w-]{6,20}|live\/[\w-]{6,20}|@[\w.-]{2,40})|youtu\.be\/[\w-]{6,20}(\?[\w=&%-]*)?)$/;
var SRC_RE = /^https:\/\/[\w.-]+\.[a-z]{2,}(\/[^\s<>"']*)?$/i;
var str6 = (v, max) => typeof v === "string" ? v.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
var num7 = (v) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
async function sha2564(text3) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text3));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var SIDO2 = { \uC11C\uC6B8\uD2B9\uBCC4\uC2DC: "\uC11C\uC6B8", \uBD80\uC0B0\uAD11\uC5ED\uC2DC: "\uBD80\uC0B0", \uB300\uAD6C\uAD11\uC5ED\uC2DC: "\uB300\uAD6C", \uC778\uCC9C\uAD11\uC5ED\uC2DC: "\uC778\uCC9C", \uAD11\uC8FC\uAD11\uC5ED\uC2DC: "\uAD11\uC8FC", \uB300\uC804\uAD11\uC5ED\uC2DC: "\uB300\uC804", \uC6B8\uC0B0\uAD11\uC5ED\uC2DC: "\uC6B8\uC0B0", \uC138\uC885\uD2B9\uBCC4\uC790\uCE58\uC2DC: "\uC138\uC885", \uACBD\uAE30\uB3C4: "\uACBD\uAE30", \uAC15\uC6D0\uB3C4: "\uAC15\uC6D0", \uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4: "\uAC15\uC6D0", \uCDA9\uCCAD\uBD81\uB3C4: "\uCDA9\uBD81", \uCDA9\uCCAD\uB0A8\uB3C4: "\uCDA9\uB0A8", \uC804\uB77C\uBD81\uB3C4: "\uC804\uBD81", \uC804\uBD81\uD2B9\uBCC4\uC790\uCE58\uB3C4: "\uC804\uBD81", \uC804\uB77C\uB0A8\uB3C4: "\uC804\uB0A8", \uACBD\uC0C1\uBD81\uB3C4: "\uACBD\uBD81", \uACBD\uC0C1\uB0A8\uB3C4: "\uACBD\uB0A8", \uC81C\uC8FC\uD2B9\uBCC4\uC790\uCE58\uB3C4: "\uC81C\uC8FC" };
var sidoOf = (addr) => {
  const t = (addr || "").trim().split(/\s+/)[0] || "";
  return SIDO2[t] || t.slice(0, 2);
};
function clean3(input) {
  const lat = num7(input?.lat), lng = num7(input?.lng);
  const okLL = lat != null && lng != null && lat > 32 && lat < 39.5 && lng > 124 && lng < 132;
  const video = str6(input?.video, 200);
  const kurl = str6(input?.kurl, 120);
  const address = str6(input?.address, 120), road = str6(input?.road, 120);
  const photoIds = [];
  for (const id of Array.isArray(input?.photoIds) ? input.photoIds : []) {
    if (typeof id === "string" && PHOTO_RE4.test(id) && !photoIds.includes(id)) photoIds.push(id);
    if (photoIds.length >= MAX_PHOTOS2) break;
  }
  return {
    name: str6(input?.name, 60),
    kakaoId: /^\d{1,15}$/.test(String(input?.kakaoId || "")) ? String(input.kakaoId) : "",
    kurl: /^https?:\/\/place\.map\.kakao\.com\/\d{1,15}$/.test(kurl) ? kurl.replace(/^http:/, "https:") : "",
    address,
    road,
    sido: sidoOf(road || address),
    phone: str6(input?.phone, 20).replace(/[^0-9-]/g, ""),
    cat: str6(input?.cat, 40),
    lat: okLL ? Math.round(lat * 1e6) / 1e6 : null,
    lng: okLL ? Math.round(lng * 1e6) / 1e6 : null,
    menu: str6(input?.menu, 100),
    review: str6(input?.review, 300),
    video: YT_RE.test(video) ? video : "",
    youtuber: str6(input?.youtuber, 30),
    show: str6(input?.show, 30),
    // 채널·코너 이름 (예: 먹을텐데)
    src: SRC_RE.test(str6(input?.src, 300)) ? str6(input?.src, 300) : "",
    seed: /^[a-z0-9-]{1,20}$/.test(String(input?.seed || "")) ? String(input.seed) : "",
    photoIds
  };
}
async function ownPhotos2(ids, authors, isOwner, keep = []) {
  const ok = [];
  for (const p of ids) {
    if (keep.includes(p)) {
      ok.push(p);
      continue;
    }
    const m = await gphotos2().getMetadata(p).catch(() => null);
    if (!m) continue;
    if (isOwner || authors.some((x) => x && m.metadata?.author === x)) ok.push(p);
  }
  return ok;
}
var picks_default = async (req, context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const a = await accessOf(req);
  if (!a.canView) return jsonResponse({ error: a.needGuest ? "guest-login" : "link required" }, { status: 401 });
  const isOwner = a.canEdit;
  if (!isOwner) {
    const share = await readShare(req.method !== "GET");
    if (share && share.tabs && share.tabs.food === false) {
      if (req.method === "GET") return jsonResponse({ items: [], count: 0, hidden: true });
      return jsonResponse({ error: "closed" }, { status: 403 });
    }
  }
  const token = (req.headers.get("x-author") || "").trim();
  const author = /^[A-Za-z0-9_-]{24,100}$/.test(token) ? await sha2564("gs|" + token) : "";
  const acct = a.guest ? await sha2564("gs|acct|" + a.guest.id) : "";
  const isMine = (p) => !!acct && p.author === acct || !!author && p.author === author;
  const id = context.params?.id;
  const s = store10();
  const strip2 = (p) => {
    const { author: _a, ...rest } = p;
    return { ...rest, mine: isMine(p) };
  };
  try {
    if (req.method === "GET" && new URL(req.url).searchParams.get("hold")) {
      if (!isOwner) return jsonResponse({ error: "edit not allowed" }, { status: 403 });
      return jsonResponse({ ok: true, hold: await s.get("seedhold", { type: "json" }).catch(() => null) || {} });
    }
    if (req.method === "GET") {
      const { blobs } = await s.list({ prefix: "p-" });
      const all = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
      if (new URL(req.url).searchParams.get("count")) {
        if (!isOwner) return jsonResponse({ error: "edit not allowed" }, { status: 403 });
        return jsonResponse({ ok: true, pending: all.filter((p) => p.status === "pending").length });
      }
      const items = all.filter((p) => isOwner || p.status === "ok" || isMine(p)).map(strip2).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
      return jsonResponse({ items, count: items.length });
    }
    if (req.method === "POST" && !id) {
      const input = await req.json();
      if (input?.action === "hold") {
        if (!isOwner) return jsonResponse({ error: "edit not allowed" }, { status: 403 });
        const hold = await s.get("seedhold", { type: "json" }).catch(() => null) || {};
        const now2 = (/* @__PURE__ */ new Date()).toISOString();
        for (const x of Array.isArray(input.seeds) ? input.seeds.slice(0, 400) : []) {
          const seed = String(x?.seed || "");
          if (!/^[a-z0-9-]{1,20}$/.test(seed)) continue;
          if (x.st === "hold" || x.st === "drop") hold[seed] = { st: x.st, why: str6(x.why, 20), at: now2 };
          else delete hold[seed];
        }
        await s.setJSON("seedhold", hold);
        return jsonResponse({ ok: true, hold });
      }
      if (!isOwner && !acct && !author) return jsonResponse({ error: "author key required" }, { status: 400 });
      const body = clean3(input);
      if (!body.name || body.lat == null || !body.kakaoId && !isOwner) return jsonResponse({ error: "pick a place" }, { status: 400 });
      const nameKey = (x) => String(x || "").replace(/\s+/g, "").toLowerCase();
      const near = (p) => p.lat != null && Math.abs(p.lat - body.lat) < 1e-3 && Math.abs(p.lng - body.lng) < 12e-4;
      const { blobs } = await s.list({ prefix: "p-" });
      for (const b of blobs) {
        const p = await s.get(b.key, { type: "json" }).catch(() => null);
        if (p && (body.kakaoId && p.kakaoId === body.kakaoId || !body.kakaoId && nameKey(p.name) === nameKey(body.name) && near(p))) return jsonResponse({ error: "exists", item: isOwner || p.status === "ok" || isMine(p) ? strip2(p) : null }, { status: 409 });
      }
      body.photoIds = await ownPhotos2(body.photoIds, [acct, author], isOwner);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const item = {
        id: crypto.randomUUID(),
        ...body,
        by: isOwner ? "\uC6B4\uC601\uC790" : a.guest ? a.guest.nickname : "\uAC8C\uC2A4\uD2B8",
        byOwner: isOwner,
        guestId: a.guest ? a.guest.id : null,
        author: isOwner ? "owner" : acct || author,
        status: isOwner ? "ok" : "pending",
        createdAt: now,
        updatedAt: now
      };
      await s.setJSON("p-" + item.id, item);
      return jsonResponse({ item: strip2(item) }, { status: 201 });
    }
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return jsonResponse({ error: "not found" }, { status: 404 });
    const cur = await s.get("p-" + id, { type: "json" });
    if (!cur) return jsonResponse({ error: "not found" }, { status: 404 });
    const mine = isMine(cur);
    if (!isOwner && !mine) return jsonResponse({ error: "not yours" }, { status: 403 });
    if (req.method === "PUT") {
      const input = await req.json();
      let next;
      if (isOwner && typeof input?.status === "string" && Object.keys(input).length === 1) {
        if (!STATUSES2.includes(input.status)) return jsonResponse({ error: "bad status" }, { status: 400 });
        next = { ...cur, status: input.status, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      } else {
        const body = clean3({ ...cur, ...input });
        if (!body.name || body.lat == null) return jsonResponse({ error: "pick a place" }, { status: 400 });
        body.photoIds = await ownPhotos2(body.photoIds, [acct, author], isOwner, cur.photoIds || []);
        next = { ...cur, ...body, status: isOwner ? cur.status : "pending", updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
        const removed = (cur.photoIds || []).filter((p) => !body.photoIds.includes(p));
        await Promise.all(removed.map((p) => gphotos2().delete(p).catch(() => {
        })));
      }
      await s.setJSON("p-" + id, next);
      return jsonResponse({ item: strip2(next) });
    }
    if (req.method === "DELETE") {
      await s.delete("p-" + id);
      await Promise.all((cur.photoIds || []).map((p) => gphotos2().delete(p).catch(() => {
      })));
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config24 = {
  path: ["/api/picks", "/api/picks/:id"]
};

// ../netlify/functions/fixes.mts
var store11 = () => getStore({ name: "fixes", consistency: "strong" });
var MAX_REPORTS = 300;
var str7 = (v, max) => typeof v === "string" ? v.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
var text2 = (v, max) => typeof v === "string" ? v.replace(/[\u0000-\u0009\u000b-\u001f]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "";
var keyOk = (k) => k.length >= 3 && k.length <= 200;
var num8 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 1e5) / 1e5 : null;
};
async function readAll4() {
  const d = await store11().get("all", { type: "json" }).catch(() => null);
  return { hidden: d && d.hidden || {}, edits: d && d.edits || {} };
}
var fixes_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const a = await accessOf(req);
  if (!a.canView) return jsonResponse({ error: a.needGuest ? "guest-login" : "link required" }, { status: 401 });
  const isOwner = a.canEdit;
  const s = store11();
  try {
    if (req.method === "GET") {
      const q = new URL(req.url).searchParams;
      if (q.get("count") || q.get("reports")) {
        if (!isOwner) return jsonResponse({ error: "edit not allowed" }, { status: 403 });
        const { blobs } = await s.list({ prefix: "r-" });
        const all = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
        if (q.get("count")) return jsonResponse({ ok: true, unread: all.filter((r) => r.status === "new").length });
        const names = {};
        try {
          (await listGuests()).forEach((g) => {
            if (g.realName) names[g.id] = g.realName;
          });
        } catch {
        }
        all.forEach((r) => {
          if (r.guestId && names[r.guestId]) r.realName = names[r.guestId];
        });
        all.sort((x, y) => (x.status === "new" ? 0 : 1) - (y.status === "new" ? 0 : 1) || String(y.at).localeCompare(String(x.at)));
        return jsonResponse({ ok: true, items: all });
      }
      const d2 = await readAll4();
      return jsonResponse({ ok: true, hidden: isOwner ? d2.hidden : Object.fromEntries(Object.keys(d2.hidden).map((k) => [k, 1])), edits: d2.edits });
    }
    if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, { status: 405 });
    const body = await req.json().catch(() => ({}));
    const act = String(body?.action || "");
    const key = str7(body?.key, 200);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (act === "report") {
      if (!keyOk(key)) return jsonResponse({ error: "bad key" }, { status: 400 });
      const t = text2(body?.text, 500);
      if (t.length < 2) return jsonResponse({ error: "text required" }, { status: 400 });
      const { blobs } = await s.list({ prefix: "r-" });
      if (blobs.length >= MAX_REPORTS) return jsonResponse({ error: "too many" }, { status: 429 });
      const item = {
        id: crypto.randomUUID(),
        key,
        title: str7(body?.title, 80),
        cat: str7(body?.cat, 20),
        text: t,
        lat: num8(body?.lat),
        lng: num8(body?.lng),
        by: isOwner ? "\uC6B4\uC601\uC790" : a.guest ? a.guest.nickname : "\uAC8C\uC2A4\uD2B8",
        guestId: a.guest ? a.guest.id : null,
        status: "new",
        at: now
      };
      await s.setJSON("r-" + item.id, item);
      return jsonResponse({ ok: true }, { status: 201 });
    }
    if (!isOwner) return jsonResponse({ error: "edit not allowed" }, { status: 403 });
    if (act === "rstatus" || act === "rdel") {
      const id = String(body?.id || "");
      if (!/^[0-9a-f-]{36}$/.test(id)) return jsonResponse({ error: "not found" }, { status: 404 });
      if (act === "rdel") {
        await s.delete("r-" + id);
        return jsonResponse({ ok: true });
      }
      const cur = await s.get("r-" + id, { type: "json" });
      if (!cur) return jsonResponse({ error: "not found" }, { status: 404 });
      const st = ["new", "done", "dismiss"].includes(body?.status) ? body.status : "done";
      await s.setJSON("r-" + id, { ...cur, status: st, doneAt: now });
      return jsonResponse({ ok: true });
    }
    if (!keyOk(key)) return jsonResponse({ error: "bad key" }, { status: 400 });
    const d = await readAll4();
    if (act === "hide") d.hidden[key] = { title: str7(body?.title, 80), cat: str7(body?.cat, 20), at: now };
    else if (act === "unhide") delete d.hidden[key];
    else if (act === "edit") {
      const f = body?.fix || {};
      const url = (v) => {
        const s2 = str7(v, 300);
        return /^https?:\/\/[^\s<>"']+$/i.test(s2) ? s2 : "";
      };
      const fix2 = { title: str7(f.title, 80), addr: str7(f.addr, 150), tel: str7(f.tel, 30), hours: text2(f.hours, 200), note: text2(f.note, 500), rv: url(f.rv), web: url(f.web) };
      Object.keys(fix2).forEach((k) => {
        if (!fix2[k]) delete fix2[k];
      });
      if (Object.keys(fix2).length) d.edits[key] = { ...fix2, orig: str7(body?.title, 80), cat: str7(body?.cat, 20), at: now };
      else delete d.edits[key];
    } else return jsonResponse({ error: "bad action" }, { status: 400 });
    await s.setJSON("all", d);
    return jsonResponse({ ok: true, hidden: d.hidden, edits: d.edits });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config25 = {
  path: "/api/fixes"
};

// ../netlify/functions/camping.mts
var FALLBACK_KEY10 = "";
var BASE = "https://apis.data.go.kr/B551011/GoCamping";
var TTL_MS9 = 24 * 60 * 60 * 1e3;
var PAGE = 300;
var FULL_CHUNK = 300;
var LIST_CHUNK = 1200;
var store12 = () => getStore("cache");
var https = (u) => {
  const s = String(u || "").trim();
  return /^http:\/\//i.test(s) ? "https://" + s.slice(7) : s;
};
var str8 = (v, n = 300) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
var SIDO3 = { \uC11C\uC6B8\uC2DC: "\uC11C\uC6B8", \uC11C\uC6B8\uD2B9\uBCC4\uC2DC: "\uC11C\uC6B8", \uBD80\uC0B0\uC2DC: "\uBD80\uC0B0", \uBD80\uC0B0\uAD11\uC5ED\uC2DC: "\uBD80\uC0B0", \uB300\uAD6C\uC2DC: "\uB300\uAD6C", \uB300\uAD6C\uAD11\uC5ED\uC2DC: "\uB300\uAD6C", \uC778\uCC9C\uC2DC: "\uC778\uCC9C", \uC778\uCC9C\uAD11\uC5ED\uC2DC: "\uC778\uCC9C", \uAD11\uC8FC\uC2DC: "\uAD11\uC8FC", \uAD11\uC8FC\uAD11\uC5ED\uC2DC: "\uAD11\uC8FC", \uB300\uC804\uC2DC: "\uB300\uC804", \uB300\uC804\uAD11\uC5ED\uC2DC: "\uB300\uC804", \uC6B8\uC0B0\uC2DC: "\uC6B8\uC0B0", \uC6B8\uC0B0\uAD11\uC5ED\uC2DC: "\uC6B8\uC0B0", \uC138\uC885\uC2DC: "\uC138\uC885", \uC138\uC885\uD2B9\uBCC4\uC790\uCE58\uC2DC: "\uC138\uC885", \uACBD\uAE30\uB3C4: "\uACBD\uAE30", \uAC15\uC6D0\uB3C4: "\uAC15\uC6D0", \uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4: "\uAC15\uC6D0", \uCDA9\uCCAD\uBD81\uB3C4: "\uCDA9\uBD81", \uCDA9\uCCAD\uB0A8\uB3C4: "\uCDA9\uB0A8", \uC804\uB77C\uBD81\uB3C4: "\uC804\uBD81", \uC804\uBD81\uD2B9\uBCC4\uC790\uCE58\uB3C4: "\uC804\uBD81", \uC804\uB77C\uB0A8\uB3C4: "\uC804\uB0A8", \uACBD\uC0C1\uBD81\uB3C4: "\uACBD\uBD81", \uACBD\uC0C1\uB0A8\uB3C4: "\uACBD\uB0A8", \uC81C\uC8FC\uB3C4: "\uC81C\uC8FC", \uC81C\uC8FC\uD2B9\uBCC4\uC790\uCE58\uB3C4: "\uC81C\uC8FC" };
var sido = (v) => {
  const s = str8(v, 20);
  return SIDO3[s] || s.slice(0, 2);
};
var KEEP = [
  "contentId",
  "facltNm",
  "lineIntro",
  "intro",
  "featureNm",
  "induty",
  "lctCl",
  "doNm",
  "sigunguNm",
  "addr1",
  "addr2",
  "mapX",
  "mapY",
  "direction",
  "tel",
  "homepage",
  "resveUrl",
  "resveCl",
  "facltDivNm",
  "mangeDivNm",
  "manageSttus",
  "hvofBgnde",
  "hvofEnddle",
  "operPdCl",
  "operDeCl",
  "gnrlSiteCo",
  "autoSiteCo",
  "glampSiteCo",
  "caravSiteCo",
  "indvdlCaravSiteCo",
  "siteBottomCl1",
  "siteBottomCl2",
  "siteBottomCl3",
  "siteBottomCl4",
  "siteBottomCl5",
  "glampInnerFclty",
  "caravInnerFclty",
  "trlerAcmpnyAt",
  "caravAcmpnyAt",
  "toiletCo",
  "swrmCo",
  "wtrplCo",
  "brazierCl",
  "sbrsCl",
  "sbrsEtc",
  "posblFcltyCl",
  "posblFcltyEtc",
  "exprnProgrm",
  "clturEvent",
  "themaEnvrnCl",
  "eqpmnLendCl",
  "animalCmgCl",
  "tourEraCl",
  "firstImageUrl",
  "modifiedtime"
];
function trimFull(it) {
  const o = {};
  for (const k of KEEP) {
    const v = it?.[k];
    if (v === void 0 || v === null || v === "") continue;
    o[k] = k === "intro" ? str8(v, 1200) : k === "firstImageUrl" ? https(v) : typeof v === "string" ? str8(v, 400) : v;
  }
  return o;
}
function compact(it, k) {
  const y = Number(it.mapY), x = Number(it.mapX);
  if (!(y > 32 && y < 39.5 && x > 124 && x < 132)) return null;
  const o = {
    id: String(it.contentId),
    k,
    n: str8(it.facltNm, 60),
    t: str8(it.induty, 60),
    s: sido(it.doNm),
    g: str8(it.sigunguNm, 20),
    a: str8(it.addr1, 120),
    y: Math.round(y * 1e5) / 1e5,
    x: Math.round(x * 1e5) / 1e5,
    p: str8(it.tel, 30),
    w: str8(it.homepage, 200),
    rv: str8(it.resveUrl, 200),
    img: https(it.firstImageUrl),
    li: str8(it.lineIntro, 80),
    an: str8(it.animalCmgCl, 20),
    st: str8(it.manageSttus, 10),
    lc: str8(it.lctCl, 40),
    th: str8(it.themaEnvrnCl, 60)
  };
  for (const key of Object.keys(o)) if (o[key] === "") delete o[key];
  return o;
}
async function refresh(key) {
  const first = await callGovApi(BASE, "basedList", key, { numOfRows: PAGE, pageNo: 1 });
  if (!first.ok && !first.items.length) throw new Error(first.resultMsg || first.resultCode || "gocamping failed");
  const total = Number(first.raw?.response?.body?.totalCount) || first.items.length;
  const pages = Math.min(20, Math.ceil(total / PAGE));
  let all = first.items.slice();
  const rest = [];
  for (let p = 2; p <= pages; p++) rest.push(callGovApi(BASE, "basedList", key, { numOfRows: PAGE, pageNo: p }));
  for (const r of await Promise.all(rest)) all = all.concat(r.items || []);
  const full = all.map(trimFull).filter((o) => o.contentId);
  const s = store12();
  const nFull = Math.ceil(full.length / FULL_CHUNK);
  const list = [];
  for (let i = 0; i < nFull; i++) {
    const part = full.slice(i * FULL_CHUNK, (i + 1) * FULL_CHUNK);
    await s.setJSON("gocamp-full-" + i, part);
    part.forEach((it) => {
      const c = compact(it, i);
      if (c) list.push(c);
    });
  }
  const nList = Math.ceil(list.length / LIST_CHUNK);
  for (let i = 0; i < nList; i++) await s.setJSON("gocamp-list-" + i, list.slice(i * LIST_CHUNK, (i + 1) * LIST_CHUNK));
  const meta = { at: Date.now(), total: list.length, nFull, nList };
  await s.setJSON("gocamp-meta", meta);
  return { meta, list };
}
async function readList(meta) {
  const s = store12();
  let list = [];
  for (let i = 0; i < (meta.nList || 0); i++) list = list.concat(await s.get("gocamp-list-" + i, { type: "json" }) || []);
  return list;
}
var camping_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const share = await viewerShare(req);
  if (share && share.tabs && share.tabs.camp === false) return jsonResponse({ items: [], hidden: true });
  const q = new URL(req.url).searchParams;
  const key = Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY10;
  const s = store12();
  try {
    const img2 = q.get("img");
    if (img2) {
      if (!/^\d{1,12}$/.test(img2)) return jsonResponse({ error: "bad id" }, { status: 400 });
      const ck = "gocamp-img-" + img2;
      const hit = await s.get(ck, { type: "json" });
      if (hit && Date.now() - (hit.at || 0) < 7 * TTL_MS9) return jsonResponse(hit);
      const r = await callGovApi(BASE, "imageList", key, { contentId: img2, numOfRows: 30 });
      const out = { at: Date.now(), images: (r.items || []).map((x) => https(x.imageUrl)).filter((u) => /^https:\/\//.test(u)).slice(0, 30) };
      if (r.ok || out.images.length) await s.setJSON(ck, out);
      return jsonResponse(out);
    }
    let meta = await s.get("gocamp-meta", { type: "json" });
    const id = q.get("id");
    if (id) {
      const k = Number(q.get("k"));
      if (!meta || !(k >= 0 && k < (meta.nFull || 0))) return jsonResponse({ error: "not found" }, { status: 404 });
      const part = await s.get("gocamp-full-" + k, { type: "json" }) || [];
      const it = part.find((x) => String(x.contentId) === id);
      return it ? jsonResponse({ item: it }) : jsonResponse({ error: "not found" }, { status: 404 });
    }
    if (meta && Date.now() - (meta.at || 0) < TTL_MS9) return jsonResponse({ items: await readList(meta), at: meta.at, cached: true });
    try {
      const r = await refresh(key);
      return jsonResponse({ items: r.list, at: r.meta.at });
    } catch (e) {
      if (meta) return jsonResponse({ items: await readList(meta), at: meta.at, stale: true });
      return jsonResponse({ items: [], error: String(e?.message || e).slice(0, 120) }, { status: 502 });
    }
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config26 = {
  path: "/api/camping"
};

// ../netlify/functions/campshops.mts
var store13 = () => getStore({ name: "campshops", consistency: "strong" });
var str9 = (v, n) => typeof v === "string" ? v.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n) : "";
var num9 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 1e5) / 1e5 : null;
};
var campshops_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    if (req.method === "GET") {
      const share = await viewerShare(req);
      if (share && share.tabs && share.tabs.camp === false) return jsonResponse({ items: [], hidden: true });
      const d = await store13().get("all", { type: "json" });
      return jsonResponse({ items: d && d.items || [], at: d && d.at || null });
    }
    if (req.method === "PUT") {
      const body = await req.json().catch(() => ({}));
      if (!Array.isArray(body?.items)) return jsonResponse({ error: "items must be an array" }, { status: 400 });
      const seen = /* @__PURE__ */ new Set();
      const items = body.items.slice(0, 6e3).map((s) => {
        const y = num9(s?.y), x = num9(s?.x);
        const u = str9(s?.u, 120).replace(/^http:/, "https:");
        return {
          id: /^\d{1,15}$/.test(String(s?.id || "")) ? String(s.id) : "",
          n: str9(s?.n, 60),
          cat: str9(s?.cat, 80),
          a: str9(s?.a, 120),
          p: str9(s?.p, 20).replace(/[^0-9-]/g, ""),
          y,
          x,
          u: /^https:\/\/place\.map\.kakao\.com\/\d{1,15}$/.test(u) ? u : ""
        };
      }).filter((s) => {
        if (!s.id || !s.n || s.y == null || s.x == null || seen.has(s.id)) return false;
        if (!(s.y > 32 && s.y < 39.5 && s.x > 124 && s.x < 132)) return false;
        seen.add(s.id);
        return true;
      });
      const at = (/* @__PURE__ */ new Date()).toISOString();
      await store13().setJSON("all", { items, at });
      return jsonResponse({ ok: true, count: items.length, at });
    }
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config27 = {
  path: "/api/campshops"
};

// ../netlify/functions/placedetail.mts
var FALLBACK_KEY11 = "";
var TOUR_BASE5 = "https://apis.data.go.kr/B551011/KorService2";
var clean4 = (v) => String(v ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
var https2 = (v) => String(v ?? "").trim().replace(/^http:\/\//i, "https://");
var firstHref = (v) => {
  const m = String(v ?? "").match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0].replace(/^http:\/\//i, "https://") : "";
};
var INTRO = {
  "12": [["infocenter", "\uBB38\uC758 \uBC0F \uC548\uB0B4"], ["usetime", "\uC774\uC6A9\uC2DC\uAC04"], ["restdate", "\uC26C\uB294\uB0A0"], ["parking", "\uC8FC\uCC28"], ["expguide", "\uCCB4\uD5D8 \uC548\uB0B4"], ["chkbabycarriage", "\uC720\uBAA8\uCC28"], ["chkpet", "\uBC18\uB824\uB3D9\uBB3C"]],
  "39": [["firstmenu", "\uB300\uD45C \uBA54\uB274"], ["treatmenu", "\uCDE8\uAE09 \uBA54\uB274"], ["opentimefood", "\uC601\uC5C5\uC2DC\uAC04"], ["restdatefood", "\uC26C\uB294\uB0A0"], ["infocenterfood", "\uBB38\uC758 \uBC0F \uC548\uB0B4"], ["parkingfood", "\uC8FC\uCC28"], ["packing", "\uD3EC\uC7A5"], ["reservationfood", "\uC608\uC57D"]],
  "15": [["eventstartdate", "\uC2DC\uC791\uC77C"], ["eventenddate", "\uC885\uB8CC\uC77C"], ["eventplace", "\uD589\uC0AC \uC7A5\uC18C"], ["playtime", "\uACF5\uC5F0 \uC2DC\uAC04"], ["usetimefestival", "\uC774\uC6A9 \uC694\uAE08"], ["spendtimefestival", "\uAD00\uB78C \uC18C\uC694\uC2DC\uAC04"], ["agelimit", "\uAD00\uB78C \uAC00\uB2A5 \uC5F0\uB839"], ["sponsor1", "\uC8FC\uCD5C"], ["sponsor1tel", "\uC8FC\uCD5C \uC5F0\uB77D\uCC98"], ["sponsor2", "\uC8FC\uAD00"]],
  "28": [["infocenterleports", "\uBB38\uC758 \uBC0F \uC548\uB0B4"], ["usetimeleports", "\uC774\uC6A9\uC2DC\uAC04"], ["restdateleports", "\uC26C\uB294\uB0A0"], ["usefeeleports", "\uC774\uC6A9 \uC694\uAE08"], ["parkingleports", "\uC8FC\uCC28"], ["openperiod", "\uAC1C\uC7A5 \uAE30\uAC04"]],
  "32": [["infocenterlodging", "\uBB38\uC758 \uBC0F \uC548\uB0B4"], ["checkintime", "\uC785\uC2E4"], ["checkouttime", "\uD1F4\uC2E4"], ["parkinglodging", "\uC8FC\uCC28"], ["reservationlodging", "\uC608\uC57D \uC548\uB0B4"]],
  "14": [["usetimeculture", "\uC774\uC6A9\uC2DC\uAC04"], ["restdateculture", "\uC26C\uB294\uB0A0"], ["usefee", "\uC774\uC6A9 \uC694\uAE08"], ["parkingculture", "\uC8FC\uCC28"], ["infocenterculture", "\uBB38\uC758 \uBC0F \uC548\uB0B4"]]
};
async function sha14(text3) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text3));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function km4(aLat, aLng, bLat, bLng) {
  if (!Number.isFinite(bLat) || !Number.isFinite(bLng)) return Infinity;
  const R = 6371, t = Math.PI / 180;
  const x = Math.sin((bLat - aLat) * t / 2) ** 2 + Math.cos(aLat * t) * Math.cos(bLat * t) * Math.sin((bLng - aLng) * t / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function tourCredit(code) {
  const m = String(code ?? "").match(/Type\s*(\d)/i);
  return "\uD55C\uAD6D\uAD00\uAD11\uACF5\uC0AC" + (m ? ` \xB7 \uACF5\uACF5\uB204\uB9AC \uC81C${m[1]}\uC720\uD615` : "");
}
var dateFmt = (v) => /^\d{8}$/.test(v) ? `${v.slice(0, 4)}.${v.slice(4, 6)}.${v.slice(6, 8)}` : v;
async function gov(op, params, key) {
  for (let i = 0; i < 2; i++) {
    try {
      return await callGovApi(TOUR_BASE5, op, key, params, 6e3);
    } catch (_) {
    }
  }
  return { ok: false, items: [], resultCode: "timeout", resultMsg: "upstream timeout" };
}
var placedetail_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const q = new URL(req.url).searchParams;
    let id = q.get("id") || "";
    let type = q.get("type") || "";
    const debug = q.get("debug") === "1";
    const t0 = Date.now();
    const store14 = getStore("cache");
    const key = Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY11;
    let matched = "";
    const name = (q.get("q") || "").replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!id && name.length >= 2) {
      const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
      const hasLL = Number.isFinite(lat) && Number.isFinite(lng) && lat > 32 && lng > 124;
      const radius = Math.min(Math.max(Number(q.get("r")) || 3, 0.5), 8);
      const qKey = `pdq2-${await sha14(name + "|" + (hasLL ? lat.toFixed(3) + "," + lng.toFixed(3) : "") + "|" + radius)}`;
      let found = debug ? null : await store14.get(qKey, { type: "json" });
      if (!found) {
        const norm7 = (t) => String(t || "").replace(/\(.*?\)|\s+/g, "");
        const isForest = /(휴양림|산림욕장|휴양마을)$/.test(name.replace(/\s+/g, ""));
        const core = name.replace(/^국립\s*/, "").replace(/\s+/g, "").replace(/(자연)?휴양림$|산림욕장$|휴양마을$/, "");
        const keywords = Array.from(/* @__PURE__ */ new Set([name, ...isForest && core.length >= 2 ? [core + "\uC790\uC5F0\uD734\uC591\uB9BC", core] : []]));
        let best = null, anyOk = false;
        for (const kw of keywords) {
          if (Date.now() - t0 > 16e3) break;
          const r = await gov("searchKeyword2", { keyword: kw, numOfRows: 30, arrange: "A" }, key);
          if (r.ok || r.items.length) anyOk = true;
          let b = null, bestD = Infinity;
          for (const it2 of r.items) {
            if (!["12", "14", "28", "32"].includes(String(it2.contenttypeid))) continue;
            if (kw === core && !/(휴양림|산림욕장|휴양마을|숲)/.test(String(it2.title))) continue;
            if (hasLL) {
              const d = km4(lat, lng, Number(it2.mapy), Number(it2.mapx));
              if (d <= radius && d < bestD) {
                b = it2;
                bestD = d;
              }
            } else if (norm7(it2.title) === norm7(name)) {
              b = it2;
              break;
            }
          }
          if (b && (!best || !best.firstimage && b.firstimage)) best = b;
          if (best && best.firstimage) break;
        }
        found = best ? { id: String(best.contentid), type: String(best.contenttypeid), title: clean4(best.title), image: https2(best.firstimage) } : { none: true };
        if (!debug && anyOk) await store14.setJSON(qKey, found);
      }
      if (found.none) return jsonResponse({ none: true, info: [], images: [] });
      if (q.get("lite") === "1") return jsonResponse({ matched: found.title || "", image: found.image || "" });
      id = found.id;
      type = found.type;
      matched = found.title || "";
    }
    if (!/^\d{1,12}$/.test(id) || !/^\d{2}$/.test(type)) return jsonResponse({ error: "bad request" }, { status: 400 });
    const cKey = `pd2-${type}-${id}`;
    if (!debug) {
      const hit = await store14.get(cKey, { type: "json" });
      if (hit) return jsonResponse({ ...hit, matched, cached: true });
    }
    const [common, intro, image] = await Promise.all([
      gov("detailCommon2", { contentId: id }, key),
      gov("detailIntro2", { contentId: id, contentTypeId: type }, key),
      gov("detailImage2", { contentId: id, imageYN: "Y" }, key)
    ]);
    const c = common.items[0] || {};
    const it = intro.items[0] || {};
    const info = [];
    for (const [field, label] of INTRO[type] || []) {
      let v = clean4(it[field]);
      if (!v) continue;
      if (field === "eventstartdate" || field === "eventenddate") v = dateFmt(v);
      info.push([label, v]);
    }
    const seen = /* @__PURE__ */ new Set();
    const images = image.items.map((x) => ({ url: https2(x.originimgurl || x.smallimageurl), desc: clean4(x.imgname), credit: tourCredit(x.cpyrhtDivCd) })).filter((x) => /^https:\/\//.test(x.url) && !seen.has(x.url) && seen.add(x.url)).slice(0, 5);
    const firstimage = https2(c.firstimage);
    if (firstimage && !seen.has(firstimage)) images.unshift({ url: firstimage, desc: "", credit: tourCredit(c.cpyrhtDivCd) });
    const out = {
      title: clean4(c.title),
      overview: clean4(c.overview),
      homepage: firstHref(c.homepage),
      tel: clean4(c.tel),
      address: [clean4(c.addr1), clean4(c.addr2)].filter(Boolean).join(" "),
      info,
      images: images.slice(0, 5)
    };
    if (matched) out.matched = matched;
    const ok = common.ok || intro.ok || image.ok;
    if (!ok) out.partial = true;
    if (debug) out.debug = { common: [common.resultCode, common.resultMsg, Object.keys(c)], intro: [intro.resultCode, Object.keys(it)], image: [image.resultCode, image.items.length] };
    else if (ok) await store14.setJSON(cKey, out);
    return jsonResponse(out);
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 502 });
  }
};
var config28 = {
  path: "/api/placedetail"
};

// ../netlify/functions/placesearch.mts
var FALLBACK_KEY12 = "";
var TOUR_BASE6 = "https://apis.data.go.kr/B551011/KorService2";
var cache4 = () => getStore("cache");
async function sha15(text3) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text3));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var okCode2 = (c) => c === "0000" || c === "00";
var placesearch_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const q = (new URL(req.url).searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (q.length < 2) return jsonResponse({ error: "bad query" }, { status: 400 });
    const cKey = `geo-${await sha15(q)}`;
    const saved = await cache4().get(cKey, { type: "json" });
    if (saved) return jsonResponse(saved);
    const key = Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY12;
    const r = await callGovApi(TOUR_BASE6, "searchKeyword2", key, { keyword: q, numOfRows: 20, arrange: "A" });
    const items = r.items.map((it) => ({
      name: String(it.title || "").trim(),
      address: [it.addr1, it.addr2].filter(Boolean).join(" ").trim(),
      lat: Number(it.mapy),
      lng: Number(it.mapx)
    })).filter((it) => it.name && it.lat > 32 && it.lat < 39.6 && it.lng > 124 && it.lng < 132.5).slice(0, 10);
    const out = { items };
    if (okCode2(r.resultCode) || items.length) await cache4().setJSON(cKey, out);
    return jsonResponse(out);
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 502 });
  }
};
var config29 = {
  path: "/api/placesearch"
};

// ../netlify/functions/restaurants.mts
var FALLBACK_KEY13 = "";
var restaurants_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const areaCode = url.searchParams.get("areaCode") || void 0;
    const mapX = url.searchParams.get("mapX");
    const mapY = url.searchParams.get("mapY");
    const radius = url.searchParams.get("radius");
    const result = await fetchPlaces({
      type: "restaurant",
      areaCode,
      mapX: mapX ? Number(mapX) : void 0,
      mapY: mapY ? Number(mapY) : void 0,
      radius: radius ? Number(radius) : void 0,
      serviceKey: Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY13
    });
    return jsonResponse({ ...result, count: result.items.length });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config30 = {
  path: "/api/restaurants"
};

// ../netlify/functions/route.mts
var API4 = "https://maps.apigw.ntruss.com/map-direction/v1/driving";
var DEFAULT_KEY_ID2 = "5v6q8ev03k";
var MAX_PTS2 = 900;
function parseLL(v) {
  const m = String(v || "").split(",").map(Number);
  if (m.length !== 2 || !m.every(Number.isFinite)) return null;
  const [lng, lat] = m;
  return lat > 32 && lat < 39 && lng > 124 && lng < 132.5 ? [lng, lat] : null;
}
var route_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const secret = Netlify.env.get("NAVER_MAP_SECRET") || "";
  const keyId = Netlify.env.get("NAVER_MAP_KEY_ID") || DEFAULT_KEY_ID2;
  if (!secret) return jsonResponse({ configured: false });
  const q = new URL(req.url).searchParams;
  const start = parseLL(q.get("start"));
  const goal = parseLL(q.get("goal"));
  if (!start || !goal) return jsonResponse({ error: "bad points" }, { status: 400 });
  const option = /^(trafast|tracomfort|traoptimal|traavoidtoll)$/.test(q.get("option") || "") ? q.get("option") : "trafast";
  try {
    const url = `${API4}?start=${start.join(",")}&goal=${goal.join(",")}&option=${option}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(1e4),
      headers: { "x-ncp-apigw-api-key-id": keyId, "x-ncp-apigw-api-key": secret }
    });
    const text3 = await res.text();
    let data;
    try {
      data = JSON.parse(text3);
    } catch {
      return jsonResponse({ error: "naver", status: res.status, message: text3.slice(0, 160) }, { status: 502 });
    }
    if (!res.ok) {
      return jsonResponse({ error: "naver", status: res.status, message: data?.error?.message || data?.message || "" }, { status: 502 });
    }
    if (data.code !== 0) return jsonResponse({ error: "noroute", code: data.code, message: data.message || "" });
    const r = data.route?.[option]?.[0];
    if (!r) return jsonResponse({ error: "noroute", message: "no route" });
    const s = r.summary || {};
    let path = Array.isArray(r.path) ? r.path : [];
    if (path.length > MAX_PTS2) {
      const step = (path.length - 1) / (MAX_PTS2 - 1);
      path = Array.from({ length: MAX_PTS2 }, (_, i) => path[Math.round(i * step)]);
    }
    return jsonResponse({
      configured: true,
      distance: Number(s.distance) || 0,
      // m
      duration: Number(s.duration) || 0,
      // ms
      toll: Number(s.tollFare) || 0,
      taxi: Number(s.taxiFare) || 0,
      fuel: Number(s.fuelPrice) || 0,
      path: path.map((p) => [Math.round(p[1] * 1e5) / 1e5, Math.round(p[0] * 1e5) / 1e5])
      // [lat, lng]
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 502 });
  }
};
var config31 = {
  path: "/api/route"
};

// ../netlify/functions/stories.mts
var KEY6 = "all";
var stories = () => getStore({ name: "stories", consistency: "strong" });
var photos4 = () => getStore({ name: "photos", consistency: "strong" });
var str10 = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
var num10 = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
var PHOTO_RE5 = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;
var MAX_PHOTOS3 = 40;
function photoList(input) {
  const raw = Array.isArray(input?.photoIds) ? input.photoIds : input?.photoId ? [input.photoId] : [];
  const out = [];
  for (const id of raw) {
    if (typeof id === "string" && PHOTO_RE5.test(id) && !out.includes(id)) out.push(id);
    if (out.length >= MAX_PHOTOS3) break;
  }
  return out;
}
function clean5(input) {
  const photoIds = photoList(input);
  return {
    title: str10(input?.title, 200) || "\uC81C\uBAA9 \uC5C6\uC74C",
    date: /^\d{4}-\d{2}-\d{2}$/.test(input?.date) ? input.date : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    category: str10(input?.category, 20) || "\uAE30\uD0C0",
    place: str10(input?.place, 300),
    region: str10(input?.region, 20),
    memo: str10(input?.memo, 2e4),
    photoIds,
    photoId: photoIds[0] || null,
    // 첫 장 (예전 화면과의 호환용)
    lat: num10(input?.lat),
    lng: num10(input?.lng),
    golf: cleanGolf(input?.golf),
    hike: cleanHike(input?.hike)
  };
}
async function readAll5() {
  const data = await stories().get(KEY6, { type: "json" });
  return Array.isArray(data) ? data : [];
}
var stories_default = async (req, context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const id = context.params?.id;
  try {
    if (req.method === "GET") {
      let items = (await readAll5()).map((s) => ({ ...s, photoIds: photoList(s) }));
      const share = await viewerShare(req);
      if (share) {
        const hidden = new Set(share.hiddenStories);
        items = !share.tabs.feed ? [] : items.filter((s) => !hidden.has(String(s.id))).map((s) => ({ ...s, memo: share.storyMemo ? s.memo : "", ...share.storyLocation ? {} : { lat: null, lng: null, place: "" } }));
      }
      items.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
      return jsonResponse({ items, count: items.length });
    }
    if (req.method === "POST" && !id) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const item = { id: crypto.randomUUID(), ...clean5(await req.json()), createdAt: now, updatedAt: now };
      const items = await readAll5();
      items.push(item);
      await stories().setJSON(KEY6, items);
      return jsonResponse({ item }, { status: 201 });
    }
    if (req.method === "PUT" && id) {
      const items = await readAll5();
      const idx = items.findIndex((s) => s.id === id);
      if (idx < 0) return jsonResponse({ error: "not found" }, { status: 404 });
      const oldPhotos = photoList(items[idx]);
      items[idx] = { ...items[idx], ...clean5(await req.json()), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await stories().setJSON(KEY6, items);
      for (const id2 of oldPhotos) if (!items[idx].photoIds.includes(id2)) await photos4().delete(id2);
      return jsonResponse({ item: items[idx] });
    }
    if (req.method === "DELETE" && id) {
      const items = await readAll5();
      const target = items.find((s) => s.id === id);
      if (!target) return jsonResponse({ ok: true });
      await stories().setJSON(KEY6, items.filter((s) => s.id !== id));
      for (const id2 of photoList(target)) await photos4().delete(id2);
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config32 = {
  path: ["/api/stories", "/api/stories/:id"]
};

// ../netlify/functions/trailroute.mts
var MAX_POINTS = 300;
var cache5 = () => getStore("cache");
function parseGpx(xml) {
  const pick2 = (tag) => {
    const out = [];
    const re = new RegExp(`<${tag}\\b([^>]*)>`, "g");
    let m;
    while (m = re.exec(xml)) {
      const lat = /\blat="([-\d.]+)"/.exec(m[1]);
      const lon = /\blon="([-\d.]+)"/.exec(m[1]);
      if (!lat || !lon) continue;
      const la = Number(lat[1]);
      const lo = Number(lon[1]);
      if (Number.isFinite(la) && Number.isFinite(lo) && la !== 0 && lo !== 0) out.push([la, lo]);
    }
    return out;
  };
  let pts = pick2("trkpt");
  if (pts.length < 2) pts = pick2("rtept");
  if (pts.length <= MAX_POINTS) return pts;
  const step = (pts.length - 1) / (MAX_POINTS - 1);
  const thin4 = [];
  for (let i = 0; i < MAX_POINTS; i++) thin4.push(pts[Math.round(i * step)]);
  return thin4;
}
async function sha16(text3) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text3));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var trailroute_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const raw = new URL(req.url).searchParams.get("url") || "";
    let target;
    try {
      target = new URL(raw);
    } catch {
      return jsonResponse({ error: "bad url" }, { status: 400 });
    }
    if (target.protocol !== "https:" || target.hostname !== "www.durunubi.kr" || target.pathname !== "/editImgUp.do" || !/\.gpx$/i.test(target.searchParams.get("filePath") || "")) {
      return jsonResponse({ error: "url not allowed" }, { status: 400 });
    }
    const key = `route-${await sha16(target.toString())}`;
    const hit = await cache5().get(key, { type: "json" });
    if (hit && Array.isArray(hit.points)) return jsonResponse({ points: hit.points, cached: true });
    const res = await fetch(target.toString(), { signal: AbortSignal.timeout(8e3) });
    if (!res.ok) return jsonResponse({ error: `gpx http ${res.status}` }, { status: 502 });
    const points = parseGpx(await res.text()).map((p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]);
    if (points.length < 2) return jsonResponse({ error: "no route in gpx" }, { status: 502 });
    await cache5().setJSON(key, { points });
    return jsonResponse({ points, cached: false });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 502 });
  }
};
var config33 = {
  path: "/api/trailroute"
};

// ../src/lib/trails.mts
var DURUNUBI_API_BASE = "https://apis.data.go.kr/B551011/Durunubi";
function extractPoint(travelerinfo, label) {
  if (!travelerinfo) return null;
  const lines = travelerinfo.split(/<br\s*\/?>/i);
  const re = new RegExp(`^[-\\s]*${label}\\s*:\\s*(.+)$`);
  for (const line of lines) {
    const match = line.trim().match(re);
    if (match) return match[1].trim();
  }
  return null;
}
function cleanText(text3) {
  if (!text3) return null;
  return text3.replace(/<br\s*\/?>/gi, "\n").trim();
}
function normalize3(rawItem) {
  return {
    id: String(rawItem.crsIdx ?? rawItem.id),
    name: rawItem.crsKorNm || rawItem.name,
    // 어느 길(해파랑길·남파랑길 등)의 코스인지: 코스 이름에서 번호 앞부분
    route: String(rawItem.crsKorNm || rawItem.name || "").replace(/\s*\d+\s*(-\s*\d+)?\s*코스.*$/, "").trim(),
    routeIdx: rawItem.routeIdx || null,
    region: rawItem.sigun || rawItem.region || "",
    distanceKm: Number(rawItem.crsDstnc) || null,
    durationMin: rawItem.crsTotlRqrmHour ? Number(rawItem.crsTotlRqrmHour) : null,
    difficulty: rawItem.crsLevel || null,
    startPoint: extractPoint(rawItem.travelerinfo, "\uC2DC\uC810"),
    endPoint: extractPoint(rawItem.travelerinfo, "\uC885\uC810"),
    gpxUrl: rawItem.gpxpath || null,
    overview: cleanText(rawItem.crsSummary)
  };
}
async function fetchTrails2(opts) {
  if (!opts.serviceKey) {
    return { mock: true, items: mockTrails };
  }
  const params = { numOfRows: "1000" };
  if (opts.region) params.sigun = opts.region;
  const result = await callGovApi(DURUNUBI_API_BASE, "courseList", opts.serviceKey, params);
  return {
    mock: false,
    resultCode: result.resultCode,
    resultMsg: result.resultMsg,
    items: result.items.map(normalize3)
  };
}

// ../netlify/functions/trails.mts
var FALLBACK_KEY14 = "";
var trails_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const region = url.searchParams.get("region") || void 0;
    const result = await fetchTrails2({
      region,
      serviceKey: Netlify.env.get("DURUNUBI_API_KEY") || Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY14
    });
    return jsonResponse({ ...result, count: result.items.length });
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 500 });
  }
};
var config34 = {
  path: "/api/trails"
};

// ../netlify/functions/weather.mts
var FALLBACK_KEY15 = "";
var FCST_API = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";
var ULTRA_API = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst";
var NOW_API = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";
var MT_API = "https://apis.data.go.kr/1400377/mtweather/mountListSearch";
var DATASETS2 = {
  fcst: { name: "\uAE30\uC0C1\uCCAD_\uB2E8\uAE30\uC608\uBCF4 \uC870\uD68C\uC11C\uBE44\uC2A4", page: "https://www.data.go.kr/data/15084084/openapi.do" },
  mt: { name: "\uC0B0\uB9BC\uCCAD \uAD6D\uB9BD\uC0B0\uB9BC\uACFC\uD559\uC6D0_\uC0B0\uC545\uAE30\uC0C1\uC815\uBCF4", page: "https://www.data.go.kr/data/15084696/openapi.do" }
};
var MT_TTL_MS = 10 * 60 * 1e3;
var NeedApply2 = class extends Error {
};
function looksUnregistered3(status, text3) {
  return status === 401 || status === 403 || /SERVICE_KEY_IS_NOT_REGISTERED|SERVICE_ACCESS_DENIED|"returnReasonCode"\s*:\s*"(30|20)"|<returnReasonCode>\s*(30|20)\s*</i.test(text3);
}
function itemsOf(data) {
  const root = data?.response || data || {};
  const code = String(root?.header?.resultCode ?? "");
  if (code === "03") return [];
  if (code && code !== "0" && code !== "00" && code !== "0000") throw new Error(`${code} ${root?.header?.resultMsg || ""}`.trim());
  let items = root?.body?.items;
  if (items && !Array.isArray(items)) items = Array.isArray(items.item) ? items.item : items.item ? [items.item] : [];
  return items || [];
}
async function getJson(url, ms = 9e3) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  const text3 = await res.text();
  if (looksUnregistered3(res.status, text3)) throw new NeedApply2();
  try {
    return JSON.parse(text3);
  } catch {
    throw new Error(`not json (${res.status}) ${text3.slice(0, 120)}`);
  }
}
async function getJsonRetry(url, deadline) {
  let lastErr;
  for (let i = 0; i < 2; i++) {
    const left = deadline - Date.now();
    if (left < 1500) break;
    try {
      return await getJson(url, Math.min(i === 0 ? 6500 : 8e3, left));
    } catch (err) {
      if (err instanceof NeedApply2) throw err;
      lastErr = err;
    }
  }
  throw lastErr || new Error("timeout");
}
function toGrid(lat, lng) {
  const RE = 6371.00877, GRID = 5, SLAT1 = 30, SLAT2 = 60, OLON = 126, OLAT = 38, XO = 43, YO = 136;
  const D = Math.PI / 180;
  const re = RE / GRID, slat1 = SLAT1 * D, slat2 = SLAT2 * D, olon = OLON * D, olat = OLAT * D;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5);
  ra = re * sf / Math.pow(ra, sn);
  let theta = lng * D - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) };
}
function kstParts(ms) {
  const d = new Date(ms + 9 * 3600 * 1e3);
  const p = (n) => String(n).padStart(2, "0");
  return { date: `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`, hour: d.getUTCHours(), min: d.getUTCMinutes(), hm: `${p(d.getUTCHours())}${p(d.getUTCMinutes())}` };
}
function latestBase(now = Date.now()) {
  const k = kstParts(now - 15 * 60 * 1e3);
  const hours = [2, 5, 8, 11, 14, 17, 20, 23];
  const h = hours.filter((x) => x <= k.hour).pop();
  if (h == null) return { date: kstParts(now - 15 * 60 * 1e3 - 24 * 3600 * 1e3).date, time: "2300" };
  return { date: k.date, time: String(h).padStart(2, "0") + "00" };
}
function prevBase(b) {
  const y = +b.date.slice(0, 4), m = +b.date.slice(4, 6) - 1, d = +b.date.slice(6, 8), h = +b.time.slice(0, 2);
  const ms = Date.UTC(y, m, d, h - 9) - 3 * 3600 * 1e3 + 20 * 60 * 1e3;
  return latestBase(ms);
}
var num11 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
async function forecastFresh(lat, lng, key, store14, deadline) {
  const { nx, ny } = toGrid(lat, lng);
  let base = latestBase();
  for (let attempt = 0; attempt < 2; attempt++) {
    const cKey = `wx-v1-${nx}-${ny}-${base.date}${base.time}`;
    const hit = await store14.get(cKey, { type: "json" });
    if (hit) return { ...hit, cached: true };
    const url = `${FCST_API}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${base.date}&base_time=${base.time}&nx=${nx}&ny=${ny}`;
    const items = itemsOf(await getJsonRetry(url, deadline));
    if (!items.length) {
      base = prevBase(base);
      continue;
    }
    const byTime = /* @__PURE__ */ new Map();
    const days = /* @__PURE__ */ new Map();
    for (const it of items) {
      const k = `${it.fcstDate}${it.fcstTime}`;
      if (!byTime.has(k)) byTime.set(k, { d: String(it.fcstDate), t: String(it.fcstTime) });
      const h = byTime.get(k);
      const v = it.fcstValue;
      switch (it.category) {
        case "TMP":
          h.tmp = num11(v);
          break;
        case "SKY":
          h.sky = num11(v);
          break;
        case "PTY":
          h.pty = num11(v);
          break;
        case "POP":
          h.pop = num11(v);
          break;
        case "WSD":
          h.wsd = num11(v);
          break;
        case "VEC":
          h.vec = num11(v);
          break;
        case "REH":
          h.reh = num11(v);
          break;
        case "PCP":
          h.pcp = String(v);
          break;
        case "SNO":
          h.sno = String(v);
          break;
        case "TMN":
        case "TMX": {
          const d = String(it.fcstDate);
          if (!days.has(d)) days.set(d, { d });
          days.get(d)[it.category === "TMN" ? "tmn" : "tmx"] = num11(v);
          break;
        }
      }
    }
    const hours = Array.from(byTime.values()).sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
    for (const h of hours) {
      if (!days.has(h.d)) days.set(h.d, { d: h.d });
    }
    const pick2 = (list) => {
      if (!list.length) return null;
      const rain = list.filter((x) => x.pty > 0);
      if (rain.length) return { pty: rain[Math.floor(rain.length / 2)].pty, sky: null };
      const sky = list.map((x) => x.sky).filter((x) => x != null).sort((a, b) => a - b);
      return { pty: 0, sky: sky[Math.floor(sky.length / 2)] ?? null };
    };
    const dayList = Array.from(days.values()).sort((a, b) => a.d.localeCompare(b.d)).map((d) => {
      const hs = hours.filter((h) => h.d === d.d);
      const temps = hs.map((h) => h.tmp).filter((x) => x != null);
      return {
        d: d.d,
        tmn: d.tmn ?? (temps.length ? Math.min(...temps) : null),
        tmx: d.tmx ?? (temps.length ? Math.max(...temps) : null),
        pop: hs.reduce((m, h) => Math.max(m, h.pop ?? 0), 0),
        wsdMax: hs.reduce((m, h) => Math.max(m, h.wsd ?? 0), 0),
        am: pick2(hs.filter((h) => +h.t < 1200 && +h.t >= 600)),
        pm: pick2(hs.filter((h) => +h.t >= 1200 && +h.t <= 1800))
      };
    }).slice(0, 4);
    const out = { at: Date.now(), nx, ny, base: base.date + base.time, days: dayList, hours: hours.slice(0, 48) };
    await store14.setJSON(cKey, out);
    return out;
  }
  return { nx, ny, none: true, days: [], hours: [] };
}
async function forecast(lat, lng, key, store14, deadline) {
  const { nx, ny } = toGrid(lat, lng);
  const lastKey = `wx-last-v1-${nx}-${ny}`;
  const stale = async () => {
    const last = await store14.get(lastKey, { type: "json" }).catch(() => null);
    return last && last.days?.length && Date.now() - (last.at || 0) < 30 * 3600 * 1e3 ? { ...last, cached: true, stale: true } : null;
  };
  try {
    const f = await forecastFresh(lat, lng, key, store14, deadline);
    if (f?.days?.length) {
      if (!f.cached) await store14.setJSON(lastKey, f).catch(() => {
      });
      return f;
    }
    return await stale() || f;
  } catch (err) {
    if (err instanceof NeedApply2) throw err;
    const s = await stale();
    if (s) return s;
    throw err;
  }
}
async function nowcast(lat, lng, key, store14, deadline) {
  const { nx, ny } = toGrid(lat, lng);
  for (const back of [45, 105]) {
    const k = kstParts(Date.now() - back * 60 * 1e3);
    const base = { date: k.date, time: String(k.hour).padStart(2, "0") + "00" };
    const cKey = `wxn-v1-${nx}-${ny}-${base.date}${base.time}`;
    const hit = await store14.get(cKey, { type: "json" });
    if (hit) return hit;
    const url = `${NOW_API}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=20&dataType=JSON&base_date=${base.date}&base_time=${base.time}&nx=${nx}&ny=${ny}`;
    let items;
    try {
      items = itemsOf(await getJsonRetry(url, deadline));
    } catch (err) {
      if (err instanceof NeedApply2) throw err;
      continue;
    }
    if (!items.length) continue;
    const o = { base: base.date + base.time };
    for (const it of items) {
      const v = num11(it.obsrValue);
      switch (it.category) {
        case "T1H":
          o.tmp = v;
          break;
        case "REH":
          o.reh = v;
          break;
        case "WSD":
          o.wsd = v;
          break;
        case "VEC":
          o.vec = v;
          break;
        case "PTY":
          o.pty = v;
          break;
        case "RN1":
          o.rn1 = v;
          break;
      }
    }
    if (o.tmp == null) continue;
    await store14.setJSON(cKey, o);
    return o;
  }
  return null;
}
async function ultra(lat, lng, key, store14, deadline) {
  const { nx, ny } = toGrid(lat, lng);
  const k = kstParts(Date.now() - 45 * 60 * 1e3);
  const base = k.min >= 30 ? { date: k.date, time: String(k.hour).padStart(2, "0") + "30" } : (() => {
    const q = kstParts(Date.now() - 45 * 60 * 1e3 - 60 * 60 * 1e3);
    return { date: q.date, time: String(q.hour).padStart(2, "0") + "30" };
  })();
  const cKey = `wxu-v1-${nx}-${ny}-${base.date}${base.time}`;
  const hit = await store14.get(cKey, { type: "json" });
  if (hit) return hit;
  const url = `${ULTRA_API}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=100&dataType=JSON&base_date=${base.date}&base_time=${base.time}&nx=${nx}&ny=${ny}`;
  const items = itemsOf(await getJsonRetry(url, deadline));
  if (!items.length) return null;
  const byTime = /* @__PURE__ */ new Map();
  for (const it of items) {
    const kk = `${it.fcstDate}${it.fcstTime}`;
    if (!byTime.has(kk)) byTime.set(kk, { d: String(it.fcstDate), t: String(it.fcstTime) });
    const h = byTime.get(kk);
    const v = it.fcstValue;
    if (it.category === "SKY") h.sky = num11(v);
    else if (it.category === "PTY") h.pty = num11(v);
    else if (it.category === "T1H") h.tmp = num11(v);
    else if (it.category === "RN1") h.rn1 = String(v);
  }
  const out = { at: Date.now(), base: base.date + base.time, hours: Array.from(byTime.values()).sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t)) };
  await store14.setJSON(cKey, out);
  return out;
}
var norm5 = (s) => String(s ?? "").replace(/\s+|\(.*?\)/g, "");
async function mountainObs(name, key, store14) {
  let all = await store14.get("mtwx-v1-all", { type: "json" });
  if (!all || Date.now() - (all.at || 0) > MT_TTL_MS) {
    const baseUrl = `${MT_API}?ServiceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=1000&_type=json`;
    let rows = itemsOf(await getJson(baseUrl));
    if (!rows.length) {
      for (const back of [3, 10, 20]) {
        const k = kstParts(Date.now() - back * 60 * 1e3);
        rows = itemsOf(await getJson(`${baseUrl}&tm=${k.date}${k.hm}`));
        if (rows.length) break;
      }
    }
    all = {
      at: Date.now(),
      rows: rows.map((r) => ({
        id: String(r.obsid ?? ""),
        name: String(r.obsname ?? "").trim(),
        area: String(r.localarea ?? ""),
        tm: String(r.tm ?? ""),
        t2: num11(r.tm2m),
        t10: num11(r.tm10m),
        h2: num11(r.hm2m),
        ws2: num11(r.ws2m),
        ws10: num11(r.ws10m),
        wd: String(r.wd10mstr || r.wd2mstr || ""),
        rn: num11(r.rn ?? r.cprn),
        pa: num11(r.pa)
      }))
    };
    if (all.rows.length) await store14.setJSON("mtwx-v1-all", all);
  }
  const base = norm5(name);
  const paren = (name.match(/\((.*?)\)/) || [])[1] || "";
  const found = all.rows.filter((r) => {
    const n = norm5(r.name);
    if (!n.startsWith(base)) return false;
    return !paren || r.name.includes(paren.replace(/[시군]$/, ""));
  });
  const seen = /* @__PURE__ */ new Set();
  return found.filter((r) => seen.has(r.id) ? false : (seen.add(r.id), true)).slice(0, 3);
}
var weather_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
  if (!(lat > 32 && lat < 39.5 && lng > 124 && lng < 132)) return jsonResponse({ error: "bad lat/lng" }, { status: 400 });
  const mt = (q.get("mt") || "").replace(/\s+/g, " ").trim().slice(0, 30);
  const key = Netlify.env.get("WEATHER_API_KEY") || Netlify.env.get("TOUR_API_KEY") || FALLBACK_KEY15;
  const store14 = getStore("cache");
  const apply = [];
  const out = { apply };
  const deadline = Date.now() + 2e4;
  const jobs = [
    forecast(lat, lng, key, store14, deadline).then((f) => {
      out.fcst = f;
    }).catch((err) => {
      if (err instanceof NeedApply2) apply.push(DATASETS2.fcst);
      else out.fcstError = String(err?.message || err).slice(0, 160);
    })
  ];
  jobs.push(nowcast(lat, lng, key, store14, deadline).then((n) => {
    if (n) out.now = n;
  }).catch(() => {
  }));
  jobs.push(ultra(lat, lng, key, store14, deadline).then((u) => {
    if (u) out.ultra = u;
  }).catch(() => {
  }));
  if (mt.length >= 2) {
    jobs.push(mountainObs(mt, key, store14).then((m) => {
      out.mt = m;
    }).catch((err) => {
      if (err instanceof NeedApply2) apply.push(DATASETS2.mt);
      else out.mtError = String(err?.message || err).slice(0, 160);
    }));
  }
  await Promise.all(jobs);
  return jsonResponse(out, { headers: { "Cache-Control": "no-store" } });
};
var config35 = {
  path: "/api/weather"
};

// ../netlify/functions/wiki.mts
var KO = "https://ko.wikipedia.org/w/api.php";
var COMMONS = "https://commons.wikimedia.org/w/api.php";
var WIKIDATA = "https://www.wikidata.org/w/api.php";
var UA2 = "TravelStory/1.0 (https://travel-story-api.netlify.app; personal travel diary)";
var TTL_MS10 = 30 * 24 * 60 * 60 * 1e3;
var MAX_IMAGES = 6;
async function sha17(text3) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text3));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function mw(base, params) {
  const url = new URL(base);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { "User-Agent": UA2, "Api-User-Agent": UA2 }, signal: AbortSignal.timeout(8e3) });
  if (!res.ok) throw new Error(`wiki http ${res.status}`);
  return res.json();
}
function km5(aLat, aLng, bLat, bLng) {
  const R = 6371, t = Math.PI / 180;
  const x = Math.sin((bLat - aLat) * t / 2) ** 2 + Math.cos(aLat * t) * Math.cos(bLat * t) * Math.sin((bLng - aLng) * t / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
var norm6 = (s) => String(s ?? "").replace(/\(.*?\)|\s+/g, "").toLowerCase();
var strip = (s) => String(s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function placeTokens(addr) {
  return String(addr || "").split(/[\s,ㆍ·]+/).filter((w) => /[시군구]$/.test(w) && w.length >= 3 && !/(특별|광역)/.test(w)).slice(0, 4);
}
var BAD_FILE = /(map|지도|위치도|locator|location|logo|로고|flag|seal|emblem|coat_of_arms|\.svg$|\.gif$|\.tif|\.pdf$|\.webm$|\.ogv$)/i;
var OK_LICENSE = /^(cc[ -]?by|cc0|public domain|pd|gfdl|attribution|no restrictions)/i;
async function pagesByTitle(titles) {
  const j = await mw(KO, {
    action: "query",
    prop: "extracts|pageimages|pageprops|coordinates|info",
    exintro: "1",
    explaintext: "1",
    exchars: "900",
    piprop: "name",
    inprop: "url",
    redirects: "1",
    titles: titles.join("|")
  });
  return (j?.query?.pages || []).filter((p) => !p.missing && p.pageid);
}
var wiki_default = async (req, _context) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  const denied = await guard(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const name = (q.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 40);
  const base = name.replace(/\(.*?\)/g, "").trim();
  const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
  const hasLL = Number.isFinite(lat) && Number.isFinite(lng) && lat > 32 && lng > 124;
  const addr = (q.get("addr") || "").slice(0, 60);
  const debug = q.get("debug") === "1";
  if (base.length < 2) return jsonResponse({ error: "bad query" }, { status: 400 });
  const store14 = getStore("cache");
  const cKey = `wiki-v1-${await sha17(name + "|" + (hasLL ? lat.toFixed(2) + "," + lng.toFixed(2) : "") + "|" + addr)}`;
  if (!debug) {
    const hit = await store14.get(cKey, { type: "json" });
    if (hit && Date.now() - (hit.at || 0) < TTL_MS10) return jsonResponse({ ...hit, cached: true });
  }
  try {
    const tokens = placeTokens(addr);
    const words = tokens.map((w) => w.replace(/[시군구]$/, "")).filter((w) => w.length >= 2);
    const sure = (p) => {
      if (p.pageprops && "disambiguation" in p.pageprops) return false;
      const c = p.coordinates && p.coordinates[0];
      if (hasLL && c) return km5(lat, lng, c.lat, c.lon) <= 15;
      if (words.length) return words.some((w) => String(p.extract || "").includes(w));
      return !hasLL;
    };
    const paren = (name.match(/\((.*?)\)/) || [])[1] || "";
    const tries = Array.from(/* @__PURE__ */ new Set([
      name,
      base,
      ...paren ? [`${base} (${paren})`, `${paren} ${base}`] : [],
      ...tokens.map((w) => `${base} (${w})`),
      ...words.map((w) => `${base} (${w})`),
      ...words.map((w) => `${w} ${base}`)
    ])).slice(0, 12);
    let page = null;
    for (const p of await pagesByTitle(tries)) {
      if (sure(p)) {
        page = p;
        break;
      }
    }
    if (!page && hasLL) {
      const g = await mw(KO, { action: "query", list: "geosearch", gscoord: `${lat}|${lng}`, gsradius: "10000", gslimit: "50" });
      const cand = (g?.query?.geosearch || []).filter((x) => norm6(x.title).startsWith(norm6(base)));
      if (cand.length) {
        const ps = await pagesByTitle(cand.slice(0, 5).map((x) => x.title));
        page = ps.find(sure) || null;
      }
    }
    if (!page) {
      const out2 = { at: Date.now(), none: true, images: [] };
      if (!debug) await store14.setJSON(cKey, out2);
      return jsonResponse(out2);
    }
    const files = [];
    if (page.pageimage) files.push("File:" + page.pageimage);
    const qid = page.pageprops?.wikibase_item;
    let category = "";
    if (qid) {
      const wd = await mw(WIKIDATA, { action: "wbgetentities", ids: qid, props: "claims" }).catch(() => null);
      const cl = wd?.entities?.[qid]?.claims || {};
      for (const c of cl.P18 || []) {
        const v = c?.mainsnak?.datavalue?.value;
        if (v) files.push("File:" + v);
      }
      category = cl.P373?.[0]?.mainsnak?.datavalue?.value || "";
    }
    if (category) {
      const cm = await mw(COMMONS, { action: "query", list: "categorymembers", cmtitle: "Category:" + category, cmtype: "file", cmlimit: "20" }).catch(() => null);
      for (const m of cm?.query?.categorymembers || []) files.push(m.title);
    }
    const uniq = Array.from(new Set(files.map((f) => f.replace(/_/g, " ")))).filter((f) => !BAD_FILE.test(f)).slice(0, 20);
    let images = [];
    if (uniq.length) {
      const ii = await mw(COMMONS, {
        action: "query",
        prop: "imageinfo",
        titles: uniq.join("|"),
        iiprop: "url|size|mime|extmetadata",
        iiurlwidth: "1280",
        iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl|ImageDescription|Credit"
      });
      const byTitle = {};
      for (const p of ii?.query?.pages || []) if (p.imageinfo?.[0] && !p.missing) byTitle[p.title] = p.imageinfo[0];
      for (const t of uniq) {
        const info = byTitle[t];
        if (!info || !/^image\/(jpeg|png)$/.test(info.mime || "")) continue;
        if ((info.width || 0) < 800 || (info.height || 0) < 450) continue;
        const md = info.extmetadata || {};
        const license = strip(md.LicenseShortName?.value);
        if (!OK_LICENSE.test(license)) continue;
        images.push({
          url: info.thumburl || info.url,
          thumb: (info.thumburl || info.url || "").replace(/\/1280px-/, "/640px-"),
          wide: info.width / info.height >= 1.1,
          desc: strip(md.ImageDescription?.value).slice(0, 80),
          artist: strip(md.Artist?.value).slice(0, 40),
          license,
          licenseUrl: strip(md.LicenseUrl?.value) || null,
          page: info.descriptionurl || null
        });
      }
      images.sort((a, b) => Number(b.wide) - Number(a.wide));
      images = images.slice(0, MAX_IMAGES);
    }
    const out = {
      at: Date.now(),
      title: page.title,
      url: page.fullurl || `https://ko.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
      extract: String(page.extract || "").trim(),
      textLicense: "CC BY-SA 4.0",
      images
    };
    if (!debug) await store14.setJSON(cKey, out);
    return jsonResponse(out);
  } catch (err) {
    return jsonResponse({ error: err?.message || "unknown error" }, { status: 502 });
  }
};
var config36 = {
  path: "/api/wiki"
};

// worker.mts
var RELAY_HOSTS = /* @__PURE__ */ new Set(["www.khs.go.kr", "overpass-api.de", "overpass.kumi.systems"]);
var als = new AsyncLocalStorage();
var realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const st = als.getStore();
  let url = "";
  try {
    url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  } catch {
  }
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
  }
  if (!st || !RELAY_HOSTS.has(host)) return realFetch(input, init);
  const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const body = typeof init?.body === "string" ? init.body : "";
  const key = method + " " + url + (body ? " " + body : "");
  if (key in st.relay) return new Response(st.relay[key], { status: 200 });
  st.need.push({ url, method, body });
  throw new Error("relay needed: " + host);
};
var ROUTES = [];
for (const [fn, cfg] of [
  [attractions_default, config],
  [auth_default, config2],
  [customimages_default, config3],
  [placephotos_default, config4],
  [debug_default, config5],
  [festivals_default, config6],
  [forest_default, config7],
  [golf_default, config8],
  [golfosm_default, config9],
  [glog_default, config10],
  [gphotos_default, config11],
  [gstories_default, config12],
  [heritage_default, config13],
  [image_default, config14],
  [mapconfig_default, config15],
  [mapsearch_default, config16],
  [marks_default, config17],
  [mtnpaths_default, config18],
  [mtntrail_default, config19],
  [mtninfo_default, config20],
  [myplaces_default, config21],
  [nearby_default, config22],
  [photos_default, config23],
  [picks_default, config24],
  [fixes_default, config25],
  [camping_default, config26],
  [campshops_default, config27],
  [placedetail_default, config28],
  [placesearch_default, config29],
  [restaurants_default, config30],
  [route_default, config31],
  [stories_default, config32],
  [trailroute_default, config33],
  [trails_default, config34],
  [weather_default, config35],
  [wiki_default, config36]
]) {
  const paths = Array.isArray(cfg?.path) ? cfg.path : [cfg?.path];
  for (const p of paths) {
    if (!p) continue;
    const keys = [];
    const re = new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/:([A-Za-z0-9_]+)/g, (_, k) => {
      keys.push(k);
      return "([^/]+)";
    }) + "/?$");
    ROUTES.push({ re, keys, fn });
  }
}
var cfgCache = null;
async function loadCfgEnv() {
  if (cfgCache && Date.now() - cfgCache.at < 6e4) return cfgCache.env;
  let env = {};
  try {
    env = await getStore("config").get("env", { type: "json" }) || {};
  } catch {
  }
  cfgCache = { at: Date.now(), env };
  return env;
}
var OLD_ORIGIN = "https://travel-story-api.netlify.app";
var ALLOWED_ORIGIN = OLD_ORIGIN;
function cors(res, origin) {
  const h = new Headers(res.headers);
  if (origin === ALLOWED_ORIGIN) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Headers", "content-type, x-import-token");
    h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return new Response(res.body, { status: res.status, headers: h });
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
async function handleImport(req, env) {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }), origin);
  const json = (o, s = 200) => cors(new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } }), origin);
  if (!env.IMPORT_TOKEN || req.headers.get("x-import-token") !== env.IMPORT_TOKEN) return json({ error: "forbidden" }, 403);
  const cfg = getStore("config");
  if (await cfg.get("importLocked")) return json({ error: "locked" }, 410);
  const u = new URL(req.url);
  if (u.searchParams.get("raw")) {
    const store14 = u.searchParams.get("store") || "", key = u.searchParams.get("key") || "";
    if (!["photos", "gphotos"].includes(store14) || !/^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(key)) return json({ error: "bad key" }, 400);
    const meta = store14 === "gphotos" ? { author: "imported", at: Date.now() } : {};
    await getStore(store14).set(key, new Uint8Array(await req.arrayBuffer()), { metadata: meta });
    return json({ ok: true, n: 1 });
  }
  const body = await req.json();
  if (Array.isArray(body.check)) {
    const have = [];
    for (const c of body.check) {
      if (await getStore(c.store).getMetadata(c.key)) have.push(c.store + "/" + c.key);
    }
    return json({ ok: true, have });
  }
  let n = 0;
  for (const it of body.items || []) {
    const st = getStore(it.store);
    if (it.b64 != null) await st.set(it.key, b64ToBytes(it.b64), { metadata: it.meta || {} });
    else await st.setJSON(it.key, it.json, { metadata: it.meta || {} });
    n++;
  }
  if (body.env && typeof body.env === "object") {
    const cur = await cfg.get("env", { type: "json" }) || {};
    for (const [k, v] of Object.entries(body.env)) if (typeof v === "string" && v) cur[k] = v;
    await cfg.setJSON("env", cur);
    cfgCache = null;
  }
  if (body.done) await cfg.set("importLocked", String(Date.now()));
  return json({ ok: true, n });
}
var GOLF_LL_KEY = "golf-ll";
async function readGolfLL() {
  try {
    return await getStore("settings").get(GOLF_LL_KEY, { type: "json" }) || {};
  } catch {
    return {};
  }
}
async function mergeGolfLL(res) {
  let j;
  try {
    j = await res.clone().json();
  } catch {
    return res;
  }
  if (!j || !Array.isArray(j.items)) return res;
  const ll = await readGolfLL();
  let n = 0;
  for (const it of j.items) {
    if (it && it.lat == null && ll[it.id]) {
      it.lat = ll[it.id][0];
      it.lng = ll[it.id][1];
      n++;
    }
  }
  if (!n) return res;
  j.located = j.items.filter((x) => x && x.lat != null).length;
  const h = new Headers(res.headers);
  h.delete("content-length");
  return new Response(JSON.stringify(j), { status: res.status, headers: h });
}
async function saveGolfLL(req, url, ctx) {
  const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
  const h = new Headers();
  const ck = req.headers.get("cookie");
  if (ck) h.set("cookie", ck);
  let auth = null;
  try {
    auth = await (await route(new Request(url.origin + "/api/auth", { headers: h }), ctx)).json();
  } catch {
  }
  if (!auth || !auth.canEdit) return out({ error: "forbidden" }, 403);
  const b = await req.json().catch(() => null);
  const add = b && b.ll && typeof b.ll === "object" ? b.ll : {};
  const cur = await readGolfLL();
  let n = 0;
  for (const [id, v] of Object.entries(add)) {
    const a = v;
    if (!/^[0-9a-f]{6,40}$/.test(id) || !Array.isArray(a)) continue;
    const lat = Number(a[0]), lng = Number(a[1]);
    if (!(lat > 32 && lat < 39.5 && lng > 124 && lng < 132)) continue;
    cur[id] = [Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6];
    n++;
  }
  if (n) await getStore("settings").setJSON(GOLF_LL_KEY, cur);
  return out({ ok: true, n, total: Object.keys(cur).length });
}
var worker_default = {
  async fetch(req, env, ctx) {
    bindDB(env.DB, [env.PH1, env.PH2, env.PH3]);
    ALLOWED_ORIGIN = env.OLD_ORIGIN || OLD_ORIGIN;
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    if (url.pathname === "/api/_import") return handleImport(req, env);
    const cfgEnv = await loadCfgEnv();
    globalThis.Netlify = { env: { get: (k) => env[k] ?? cfgEnv[k] ?? void 0 } };
    if (url.pathname === "/api/_golfll" && req.method === "POST") return saveGolfLL(req, url, ctx);
    let target = req, relay = {};
    if (url.pathname === "/api/_relay" && req.method === "POST") {
      const b = await req.json().catch(() => null);
      const p = String(b?.path || "");
      if (!p.startsWith("/api/") || p.startsWith("/api/_")) return new Response(JSON.stringify({ error: "bad path" }), { status: 400, headers: { "content-type": "application/json" } });
      relay = b?.relay && typeof b.relay === "object" ? b.relay : {};
      const h = new Headers();
      for (const k of ["cookie", "x-author", "user-agent", "cf-connecting-ip"]) {
        const v = req.headers.get(k);
        if (v) h.set(k, v);
      }
      target = new Request(url.origin + p, { method: "GET", headers: h });
    }
    const st = { relay, need: [] };
    const res = await als.run(st, () => route(target, ctx));
    if (st.need.length && res.status >= 500) {
      const seen = /* @__PURE__ */ new Set();
      const relayNeed = st.need.filter((n) => {
        const k = n.method + " " + n.url + " " + n.body;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      let err = "";
      try {
        err = (await res.clone().json()).error;
      } catch {
      }
      return new Response(JSON.stringify({ error: err || "upstream", relayNeed }), { status: 502, headers: { "content-type": "application/json" } });
    }
    if (new URL(target.url).pathname === "/api/golf" && res.ok) return mergeGolfLL(res);
    return res;
  }
};
async function route(req, ctx) {
  const url = new URL(req.url);
  {
    for (const r of ROUTES) {
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
      try {
        return await r.fn(req, { params, waitUntil: (p) => ctx.waitUntil(p), ip: req.headers.get("cf-connecting-ip") || "" });
      } catch (e) {
        return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { "content-type": "application/json" } });
      }
    }
  }
  return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
}
export {
  worker_default as default
};
