
import json, sys, uuid
from pathlib import Path
user, key, proxy, model, profile_name = Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
s = json.loads((user/"settings.json").read_text())
s["main_api"] = "openai"
o = s.setdefault("oai_settings", {})
o["chat_completion_source"] = "openai"
o["reverse_proxy"] = proxy
o["proxy_password"] = key
o["openai_model"] = model
o["show_external_models"] = True

proxies = o.get("proxies") if isinstance(o.get("proxies"), list) else []
proxies = [p for p in proxies if isinstance(p, dict) and p.get("name") not in (profile_name, None)]
if not any(isinstance(p, dict) and p.get("name") == "None" for p in proxies):
    proxies.insert(0, {"name": "None", "url": "", "password": ""})
proxies.append({"name": profile_name, "url": proxy, "password": key})
o["proxies"] = proxies
o["selected_proxy"] = {"name": profile_name, "url": proxy, "password": key}
s["proxies"] = proxies
s["selected_proxy"] = o["selected_proxy"]

ext = s.setdefault("extension_settings", {})
cm = ext.setdefault("connectionManager", {})
profiles = cm.get("profiles") if isinstance(cm.get("profiles"), list) else []
profiles = [p for p in profiles if isinstance(p, dict) and p.get("name") != profile_name]
pid = str(uuid.uuid4())
profiles.append({
    "id": pid,
    "mode": "cc",
    "name": profile_name,
    "api": "openai",
    "proxy": profile_name,
    "model": model,
    "exclude": [],
})
cm["profiles"] = profiles
cm["selectedProfile"] = pid

(user/"settings.json").write_text(json.dumps(s, indent=4, ensure_ascii=False))

sec_path = user/"secrets.json"
sec = json.loads(sec_path.read_text()) if sec_path.exists() else {}
sec["api_key_openai"] = [{"id": str(uuid.uuid4()), "value": key, "label": profile_name, "active": True}]
sec_path.write_text(json.dumps(sec, indent=4)); sec_path.chmod(0o600)

pdir = user/"OpenAI Settings"
pdir.mkdir(parents=True, exist_ok=True)
n = 0
for f in pdir.glob("*.json"):
    d = json.loads(f.read_text())
    d.update({
        "chat_completion_source": "openai",
        "reverse_proxy": proxy,
        "proxy_password": key,
        "openai_model": model,
        "show_external_models": True,
        "proxies": proxies,
        "selected_proxy": o["selected_proxy"],
    })
    f.write_text(json.dumps(d, indent=4, ensure_ascii=False))
    n += 1
if n == 0:
    (pdir/"Default.json").write_text(json.dumps({
        "chat_completion_source": "openai",
        "reverse_proxy": proxy,
        "proxy_password": key,
        "openai_model": model,
        "show_external_models": True,
        "proxies": proxies,
        "selected_proxy": o["selected_proxy"],
    }, indent=4, ensure_ascii=False))
    n = 1
print(f"configured profile={profile_name} proxy={proxy} model={model} presets={n}")
