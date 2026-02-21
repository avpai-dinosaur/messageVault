import sys
import struct
import json
import logging
import os
import hashlib
from datetime import datetime
from pathlib import Path


CHROME_NM_MESSAGE_LENGTH_BYTES = 4
DOCUMENTS_DIR = Path.home() / "Documents" / "MessageVault"
DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)


def log_message(message):
    text = message["text"]
    timestamp = message["timestamp"]
    messageType = message["messageType"]
    prisonerName = message["prisonerName"]

    utc_datetime = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    year = str(utc_datetime.year)
    month = str(utc_datetime.month).zfill(2)

    filename_safe_prisonerName = "".join(c for c in prisonerName if c.isalnum()).strip()
    hash_suffix = hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]
    output_folder = DOCUMENTS_DIR / filename_safe_prisonerName / messageType / year / month
    output_folder.mkdir(parents=True, exist_ok=True)
    filename = utc_datetime.strftime("%Y-%m-%d_%H-%M-%S") + f"_{hash_suffix}.txt"
    file_path = output_folder / filename

    status = ""
    error = ""
    try:
        with open(file_path, "x", encoding="utf-8") as fout:
            fout.write(text)
        logging.debug(f"Saved message to {file_path}")
        status = "saved"
    except Exception as e:
        logging.error(f"Failed to save message: {e}")
        if isinstance(e, FileExistsError):
            status = "exists"
        else:
            status = "error"
            error = str(e)

    return {
        "status": status,
        "timestamp": timestamp,
        "messageType": messageType,
        "prisonerName": prisonerName,
        "filePath": str(file_path),
        "error": error
    }

def send_message(message):
    # Encode message as JSON and send with Chrome's expected length prefix
    encoded = json.dumps(message).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def read_message():
    # Read the message length
    raw_length = sys.stdin.buffer.read(CHROME_NM_MESSAGE_LENGTH_BYTES)
    if len(raw_length) == 0:
        sys.exit(0)
    message_length = struct.unpack("<I", raw_length)[0]

    # Read the JSON message
    message = sys.stdin.buffer.read(message_length)
    return json.loads(message.decode("utf-8"))


if __name__ == "__main__":
    # -----------------------------------------------
    # On Windows, set stdin and stdout to binary mode
    # -----------------------------------------------
    if os.name == "nt":
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)

    # --------------------------
    # Logging (NEVER to stdout!)
    # --------------------------
    logging.basicConfig(
        filename=DOCUMENTS_DIR / "native_host.log",
        filemode="a",
        level=logging.DEBUG,
        format="%(asctime)s %(levelname)s %(message)s"
    )

    logging.debug("MessageVault Native Host started.")

    while True:
        msg = read_message()
        logging.debug(f"Received message: {msg}")
        response = log_message(msg)
        send_message(response)
