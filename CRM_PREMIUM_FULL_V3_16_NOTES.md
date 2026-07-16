# CRM Premium Full V3.16 Notes

## Forecast Excel pivot summaries
- Forecast report Excel export bottom summaries were converted from flat rows into pivot-style matrices.
- First summary: **Ay Bazında Model ve Adet**.
- Second summary: **Gerçekleşme Oranına Göre Ay Bazında Model ve Adet**.
- Layout now follows the requested Excel structure: models in rows, year/months in columns.
- Weighted/probability quantities are rounded to whole numbers; no decimal values are exported.
- The two summary blocks use different colors: blue for gross quantities and green for probability-weighted quantities.

## Build check
- `npm run check:build` passed.
- `npx tsc --noEmit --pretty false | grep ForecastReportClient` returned no ForecastReportClient errors.
