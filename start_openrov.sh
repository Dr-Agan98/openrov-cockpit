#!/bin/bash

NODE_ENV=development PLATFORM=mock BOARD=mock3000 DEV_MODE=true USE_MOCK=true CPU_MOCK=123MOCK MOCK_VIDEO_TYPE=MJPEG MOCK_VIDEO_HARDWARE=true DEBUG="bridge, mcu, cpu, *:Notifications, app:mjpeg*" port=8080 configfile='/tmp/rovconfig.json' env plugins__ui-manager__selectedUI='new-ui' pluginsDownloadDirectory='/tmp/plugins' cacheDirectory='/tmp/cache' DATADIR='/tmp' IGNORE_CACHE=true LOG_LEVEL='debug' node --nolazy `dirname "$0"`/src/cockpit.js
