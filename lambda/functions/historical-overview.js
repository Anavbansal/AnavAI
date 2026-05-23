import { json, withCors } from "../shared/upstox.js";

export const handler = withCors(async (event, origin) => {
  const query = event.queryStringParameters || {};

  return json(
    200,
    {
      status: "success",
      data: {
        instrumentKey: query.instrumentKey || "NSE_EQ|INE848E01016",
        intradayV3: {
          pathTemplate: "/v3/historical-candle/intraday/{instrument_key}/{unit}/{interval}",
          units: {
            minutes: "1-300",
            hours: "1-5",
            days: "1"
          }
        },
        historicalV3: {
          pathTemplate: "/v3/historical-candle/{instrument_key}/{unit}/{interval}/{to_date}/{from_date?}",
          units: {
            minutes: "1-300",
            hours: "1-5",
            days: "1",
            weeks: "1",
            months: "1"
          },
          availability: {
            minutesAndHoursFrom: "January 2022",
            daysWeeksMonthsFrom: "January 2000"
          }
        }
      }
    },
    origin
  );
});
