# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Статуси петлі реалізації

`run-issues.sh` у корені воркспейсу проганяє тикети з `.scratch/<feature>/issues/`
і веде їхній стан у тому самому `Status:`-рядку трьома значеннями поза таблицею
вище:

| Статус        | Значення                                                       |
| ------------- | -------------------------------------------------------------- |
| `in-progress` | Тикет узятий у роботу; лежить у робочому дереві, ще не закомічений |
| `done`        | Гейт якості зелений, робота закомічена в обох репозиторіях       |
| `failed`      | Гейт червоний і після ретраю; нічого не закомічено, петля стала  |

`ready-for-agent` лишається входом у петлю: тикет береться, коли він
`ready-for-agent` і кожен номер із його `Blocked by:` має `done`.
