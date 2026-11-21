# Health Connect live aggregate range

## Root cause

The daily Health Connect read uses a closed `TimeRangeFilter.between(dayStart, syncTime)` for aggregate metrics. Active calories and steps are interval records, so the provider can expose a current interval whose end is later than the instant Arsen asks for the data. That makes the daily aggregate omit the newest interval and then appear to catch up across later refreshes.

## Plan

1. [x] Add a focused unit test for the daily aggregate query range: daily reads must be open-ended after the local day start, while session and exercise reads remain closed.
2. [x] Route only the daily aggregate query through that open-ended range; preserve the reported `rangeEnd` and all bounded attribution windows.
3. [x] Run the focused Kotlin test, the full Android unit suite, the web tests, the web build, and the Capacitor APK build.
4. [x] Reuse the same temporal filter for daily oxygen record reads so every daily metric sees the same Health Connect window.
