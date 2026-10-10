#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
npm run setup
setup_result=$?
if (( setup_result != 0 )); then
  echo "Setup stopped. Keep this window open to see the error above."
fi
read "?Press Enter to close this window."
exit "$setup_result"
