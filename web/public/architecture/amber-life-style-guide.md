# Amber Life Unified Style Guide

Status: product style guide
Date: 2026-06-04
Scope: Amber Life iOS and Windows app visual/product language.

## Product Feeling

Amber Life is a warm private life archive, not a cold productivity tool.

Brand phrase: **Your life, beautifully remembered.**

The product combines:

- memories and moments;
- photos and albums;
- people and relationships;
- calendar and tasks;
- diary/journal entries;
- email and weekly summaries;
- Veliai interaction;
- AI reflections and insights.

## Product Surfaces

Amber Life owns these app surfaces:

- Home
- Veliai
- Moments
- Calendar
- Photos
- People
- Tasks
- Diary
- Insights
- Settings

Journal/Diary is not a separate app. It is the Amber Life Diary surface and
shares the same profile lock, privacy model, Memorr sync, and Amber Bus data
plane as the rest of Amber Life.

## Visual Identity

Use a faceted amber gem plus `Amber Life` wordmark.

Palette:

| Token | Hex | Use |
| --- | --- | --- |
| `bg.app` | `#FFFCF7` | main app background |
| `bg.sidebar` | `#FFF7EA` | Windows sidebar |
| `bg.card` | `#FFFFFF` | card background |
| `bg.cardWarm` | `#FFF8EE` | emotional callouts |
| `amber.50` | `#FFF7E8` | selected states |
| `amber.500` | `#C87500` | primary actions and selected nav |
| `amber.600` | `#A85C00` | text links and active icons |
| `charcoal.900` | `#1F1A16` | primary text |
| `taupe.500` | `#8B7A67` | muted labels |
| `border.subtle` | `#F0E2CF` | card borders |
| `success.500` | `#4D8A57` | completed states |
| `info.500` | `#407BA7` | factual/travel/school info |
| `purple.500` | `#7B61A8` | milestones |
| `warning.500` | `#C98516` | due soon |
| `danger.500` | `#B84A3A` | destructive actions only |

Typography:

- Use a refined serif display face for app wordmark, page titles, emotional
  hero titles, and memory titles.
- Use native platform UI fonts for labels, body text, inputs, buttons,
  metadata, calendar cells, and task rows.
- Windows display fallback: Georgia until a licensed brand serif is bundled.
- Windows UI fallback: Segoe UI Variable / Segoe UI.

## Relationship Language

People are relationships, not contacts.

Use labels such as:

- Wife
- Daughter
- Son
- Father
- Mother
- Brother
- Sister
- Best friend

Show relationship history: photos together, events shared, last contact,
upcoming birthday, and shared moments.

## Layout Rules

iOS:

- intimate, vertical, touch-first;
- bottom tab bar with central plus action;
- image-led cards and large page titles.

Windows:

- spacious, sidebar-driven, multi-column;
- large brand in sidebar;
- page title/header top left;
- search/profile/notification cluster top right;
- cards arranged as dashboard panes without nested card clutter.

Cards:

- 8px radius.
- subtle border and shadow/material.
- warm cream selected states.
- photo cards use warm/dark overlay before white text.

## Required Styled Screens

The design language must cover:

- Home daily summary.
- Moments timeline and featured memory.
- Photos gallery and albums.
- Calendar month/week/day.
- People profile and relationship grid.
- Tasks.
- Diary composer and timeline.
- Insights weekly summary.
- Veliai interaction tab.

## Veliai Tab

Veliai is a first-class Amber Life interaction surface.

It should feel like a private life assistant inside the app:

- conversation stream;
- profile/memory context;
- suggested next steps;
- proof/evidence rail;
- photo/diary/email/task context attachments;
- no WebView and no direct owner-service calls.

Veliai answers remain advice until an owner service accepts a typed Bus action.

