import { getApiErrorInfo } from "../../screens/HomeScreen";

describe("getApiErrorInfo error classification", () => {
  test("returns null when no error provided", () => {
    expect(getApiErrorInfo(null)).toBeNull();
    expect(getApiErrorInfo(undefined)).toBeNull();
  });

  test("correctly categorizes HTTP 401 Session Expired", () => {
    const error = { response: { status: 401 }, isAxiosError: true };
    const info = getApiErrorInfo(error);
    expect(info.title).toBe("Session Expired");
    expect(info.banner).toBe("Session expired. Please log in again.");
    expect(info.isNetwork).toBe(false);
  });

  test("correctly categorizes HTTP 403 Access Restricted", () => {
    const error = { response: { status: 403 }, isAxiosError: true };
    const info = getApiErrorInfo(error);
    expect(info.title).toBe("Access Restricted");
    expect(info.banner).toBe("Access restricted. Contact dispatch.");
    expect(info.isNetwork).toBe(false);
  });

  test("correctly categorizes HTTP 404 Endpoint Not Found", () => {
    const error = { response: { status: 404 }, isAxiosError: true };
    const info = getApiErrorInfo(error);
    expect(info.title).toBe("Endpoint Not Found");
    expect(info.banner).toBe("Jobs service endpoint was not found.");
    expect(info.isNetwork).toBe(false);
  });

  test("correctly categorizes HTTP 429 Rate Limit Exceeded", () => {
    const error = { response: { status: 429 }, isAxiosError: true };
    const info = getApiErrorInfo(error);
    expect(info.title).toBe("Rate Limit Exceeded");
    expect(info.banner).toBe("Too many requests. Please wait a moment.");
    expect(info.isNetwork).toBe(false);
  });

  test("correctly categorizes HTTP 500/502/503 Server Error", () => {
    const error = { response: { status: 500 }, isAxiosError: true };
    const info = getApiErrorInfo(error);
    expect(info.title).toBe("Server Error");
    expect(info.banner).toBe("Server temporarily unavailable. Try again later.");
    expect(info.isNetwork).toBe(false);
  });

  test("correctly categorizes Axios timeout as Request Timed Out", () => {
    const error = { code: "ECONNABORTED", message: "timeout of 15000ms exceeded", isAxiosError: true };
    const info = getApiErrorInfo(error);
    expect(info.title).toBe("Request Timed Out");
    expect(info.banner).toBe("Request timed out. Please check your connection.");
    expect(info.isNetwork).toBe(true);
  });

  test("correctly categorizes genuine network error (no response)", () => {
    const error = { isAxiosError: true, message: "Network Error", code: "ERR_NETWORK" };
    const info = getApiErrorInfo(error);
    expect(info.title).toBe("Network Unavailable");
    expect(info.banner).toBe("Network unavailable. Check your connection.");
    expect(info.isNetwork).toBe(true);
  });

  test("DOES NOT classify JavaScript ReferenceError/TypeError as Network Unavailable", () => {
    const jsError = new ReferenceError("Can't find variable: user");
    const info = getApiErrorInfo(jsError);
    expect(info.title).toBe("Application Error");
    expect(info.isNetwork).toBe(false);
    expect(info.banner).not.toContain("Network unavailable");
    expect(info.detail).toContain("Can't find variable: user");
  });

  test("DOES NOT classify JSON parse or syntax error as Network Unavailable", () => {
    const parseError = new SyntaxError("Unexpected token in JSON at position 0");
    const info = getApiErrorInfo(parseError);
    expect(info.title).toBe("Application Error");
    expect(info.isNetwork).toBe(false);
    expect(info.banner).not.toContain("Network unavailable");
    expect(info.detail).toContain("Unexpected token in JSON");
  });
});
