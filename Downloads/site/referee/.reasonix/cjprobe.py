import json, os, urllib.request, urllib.error
K = os.environ["CJ_API_KEY"]
API = "https://developers.cjdropshipping.com/api2.0/v1"

def call(method, url, body=None, headers=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode()[:500]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]
    except Exception as ex:
        return "ERR", str(ex)[:200]

print("A getAccessToken(apiKey only):", call("POST", API + "/authentication/getAccessToken",
      {"apiKey": K}, {"Content-Type": "application/json"}))
print("B direct key as CJ-Access-Token:", call("GET", API + "/product/listV2?keyWord=fan&pageNum=1&pageSize=2",
      None, {"CJ-Access-Token": K}))
