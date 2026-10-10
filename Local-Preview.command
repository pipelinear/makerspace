#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
node signature-service/preview.mjs
preview_result=$?
if (( preview_result != 0 )); then
  read "?Press Enter to close this window."
fi
exit "$preview_result"
