"""
Serveur local pour filmer le site sur deux appareils en même temps (ordinateur + téléphone, même Wi-Fi).

Sert le dossier site/ comme python -m http.server, ouvert au réseau local, avec en plus un canal de synchro :
  POST /__sync  : l'appareil « pilote » envoie sa position (JSON)
  GET  /__sync  : les appareils « suiveurs » la reçoivent en continu (Server-Sent Events)
Côté pages : assets/js/tournage.js, actif seulement avec ?tournage=pilote ou ?tournage=suit.

Usage : python scripts/serve_tournage.py [port=8095]
"""
import os
import sys
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8095

state = {"value": None, "seq": 0}
changed = threading.Condition()


class Server(ThreadingHTTPServer):
    request_queue_size = 128          # le film charge des centaines d'images d'un coup
    daemon_threads = True


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"     # connexions réutilisées entre les images
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE, **kwargs)

    def do_POST(self):
        if self.path != "/__sync":
            return self.send_error(404)
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8")
        with changed:
            state["value"], state["seq"] = body, state["seq"] + 1
            changed.notify_all()
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if not self.path.startswith("/__sync"):
            return super().do_GET()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        seen = -1
        try:
            while True:
                with changed:
                    changed.wait_for(lambda: state["seq"] != seen, timeout=15)
                    seq, value = state["seq"], state["value"]
                if seq != seen and value:
                    self.wfile.write(f"data: {value}\n\n".encode("utf-8"))
                    seen = seq
                else:
                    self.wfile.write(b": ping\n\n")          # garde la connexion ouverte
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"Site servi sur le port {PORT} (réseau local). Ctrl+C pour arrêter.")
    print(f"  pilote : http://<adresse du PC>:{PORT}/?tournage=pilote")
    print(f"  suit   : http://<adresse du PC>:{PORT}/?tournage=suit")
    Server(("0.0.0.0", PORT), Handler).serve_forever()
