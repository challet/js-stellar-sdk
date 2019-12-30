import { CallBuilder } from "./call_builder";
import { Horizon } from "./horizon_api";
import forIn from "lodash/forIn";
import URI from "urijs";
import URITemplate from "urijs/src/URITemplate";

// Resources which can be included in the Horizon response via the `join`
// query-param.
const JOINABLE = ["transaction"];

export class HalResponseWrapper {
  public data: {
    [key: string]: keyof Horizon.BaseResponse | Horizon.BaseResponse;
  } = {};

  constructor(response: Horizon.BaseResponse) {
    // Extract response fields
    // TODO: do it in type-safe manner.
    forIn(response, (value: string | object, key: string) => {
      this._defineRawProperty(key, value);
    });
    if (response._links !== undefined) {
      this._parseLinks(response._links);
    }
    Object.freeze(this.data);
  }

  public out() {
    return this.data;
  }

  private _defineRawProperty(key: string, value: any): void {
    // it is enumerable
    Object.defineProperty(this.data as any, key, {
      value,
      enumerable: true,
      configurable: true,
    });
  }

  private _defineLinkProperty(key: string, func: (opts?: any) => any): void {
    // it is not enumerable
    Object.defineProperty(this.data as any, key, {
      value: func,
      enumerable: false,
      configurable: true,
    });
  }

  /**
   * Given the json response, find and convert each link into a function that
   * calls that link.
   * @private
   * @param {object} json JSON response
   * @returns {object} JSON response with string links replaced with functions
   */
  private _parseLinks(links: any): void {
    for (const key of Object.keys(links)) {
      const link: Horizon.ResponseLink = links[key];
      let included = false;
      // If the key with the link name already exists, create a copy
      if (this.data.hasOwnProperty(key)) {
        this._defineRawProperty(`${key}_attr`, this.data[key]);
        delete this.data[key];
        included = true;
      }

      let fnLink: (opts?: any) => any;
      /*
       If the resource can be side-loaded using `join` query-param then don't
       try to load from the server. We need to whitelist the keys which are
       joinable, since there are other keys like `ledger` which is included in
       some payloads, but doesn't represent the ledger resource, in that
       scenario we want to make the call to the server using the URL from links.
      */
      if (included && JOINABLE.indexOf(key) >= 0) {
        const record = new HalResponseWrapper(
          this.data[`${key}_attr`] as Horizon.BaseResponse,
        );
        // Maintain a promise based API so the behavior is the same whether you
        // are loading from the server or in-memory (via join).
        fnLink = async () => record.out();
      } else {
        fnLink = this._requestFnForLink(link as Horizon.ResponseLink);
      }
      this._defineLinkProperty(key, fnLink);
    }
  }

  /**
   * Convert a link object to a function that fetches that link.
   * @private
   * @param {object} link A link object
   * @param {bool} link.href the URI of the link
   * @param {bool} [link.templated] Whether the link is templated
   * @returns {function} A function that requests the link
   */
  private _requestFnForLink(link: Horizon.ResponseLink): (opts?: any) => any {
    return async (opts: any = {}) => {
      let uri;

      if (link.templated) {
        const template = URITemplate(link.href);
        uri = URI(template.expand(opts) as any); // TODO: fix upstream types.
      } else {
        uri = URI(link.href);
      }

      const cb = new CallBuilder(uri);
      return cb.call();
    };
  }
}
