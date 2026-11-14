# Changelog

All notable changes to **Racket Arena** will be documented in this file.

The format is inspired by **Keep a Changelog**, and this project loosely follows **Semantic Versioning (SemVer)**.

---

## [Unreleased]

### Added

* Placeholder for upcoming features.

### Changed

* Placeholder for upcoming improvements.

### Fixed

* Placeholder for upcoming bug fixes.

---

## [2.5.0] - 2026-07-18

### Added

* Introduced a **Queue Preparation** stage before a queue session officially starts.
* Added a **Start Queue** button after creating a queue session.
* Organizers can configure courts before starting the queue.
* Organizers can generate and prepare rosters before the queue starts.

### Changed

* Queue sessions are now created in a **Not Started** state instead of starting immediately.
* Players added before the queue starts now receive the same arrival timestamp when **Start Queue** is pressed.
* Players joining after the queue has started continue to receive their actual arrival timestamp when they join.
* The **Start Queue** button is replaced with the existing **End Queue** button once the queue begins.

### Fixed

* Prevented rosters from being sent to courts before the queue has officially started.

---

## [2.4.0]

### Added

* Team-colored borders when manually selecting players for a match to clearly distinguish teammates and opponents.

### Changed

* Manual player selection now updates team border colors automatically whenever the selection order changes.

---

## [2.3.0]

### Added

* Improved queue prioritization by incorporating waiting time into player selection.
* Added teammate and opponent diversity scoring to reduce repetitive matchups.

### Changed

* Refined roster generation to better balance fairness, compatibility, and match variety.

---

## [2.2.0]

### Added

* Enhanced compatibility logic with fallback widening to improve successful roster generation when valid combinations are limited.

### Changed

* Improved balancing between skill compatibility and fairness constraints.

---

## [2.1.0]

### Added

* Initial implementation of the automatic roster generation algorithm.
* Automatic team balancing based on player skill levels.
* Queue management with court assignment support.
* Match history and player statistics tracking.

---

## Notes

This changelog focuses on user-facing features and significant system improvements. Internal refactoring, code cleanup, styling adjustments, and minor maintenance updates are generally omitted unless they affect functionality or user experience.
