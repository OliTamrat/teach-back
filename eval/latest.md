# Teach-Back evaluation, 2026-10-26T19-15-20 (text-v1.json)

| Metric | Value |
| --- | --- |
| Cases | 15 |
| Critical facts found (recall) | 100% |
| Extracted facts that were real (precision) | 100% |
| Planted errors flagged | 11 of 11 |
| Other expected flags raised | 3 of 3 |
| False alarms (critical flags with no planted error) | 0 |

| Case | Facts | Planted | Flags | Missed |
| --- | --- | --- | --- | --- |
| T01-dose-planted-b | 3/3 | 1/1 | crit listener_disagreement:dose |  |
| T02-negation-dropped-b | 2/2 | 1/1 | crit single_listener:negation |  |
| T03-date-planted-b | 1/1 | 1/1 | crit listener_disagreement:date |  |
| T04-agree-no-flags | 5/5 | 0/0 | warn single_listener:dose |  |
| T05-side-planted-b | 1/1 | 1/1 | crit listener_disagreement:body_part |  |
| T06-duration-planted-b | 1/1 | 1/1 | crit listener_disagreement:duration |  |
| T07-invalid-date | 1/1 | 0/0 | crit invalid_date:date |  |
| T08-future-date-agree | 1/1 | 0/0 | none |  |
| T09-oromo-month-ambiguous | 1/1 | 0/0 | warn ambiguous_calendar:date |  |
| T10-label-conflict | 3/3 | 1/1 | crit label_conflict:frequency |  |
| T11-language-mismatch | 1/1 | 0/0 | crit language_mismatch |  |
| T12-single-listener | 4/4 | 0/0 | none |  |
| T13-child-dose-planted-b | 3/3 | 1/1 | crit listener_disagreement:dose |  |
| T14-frequency-planted-b | 3/3 | 1/1 | crit listener_disagreement:frequency |  |
| T15-two-errors-b | 6/6 | 3/3 | crit listener_disagreement:dose, crit single_listener:negation, crit listener_disagreement:date |  |
