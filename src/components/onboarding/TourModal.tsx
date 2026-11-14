import { useState } from "react";
import "./TourModal.css";
import { tourPages, type TourPage } from "./tourData";

interface TourModalProps {
  startPage: number;
  pages?: TourPage[];
  onClose: () => void;
}

export default function TourModal({
  startPage,
  pages = tourPages,
  onClose,
}: TourModalProps) {
  const [page, setPage] = useState(startPage);

  const current = pages[page];
  const isFirst = page === 0;
  const isLast = page === pages.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
      return;
    }

    setPage((p) => p + 1);
  };

  const handlePrevious = () => {
    if (!isFirst) {
      setPage((p) => p - 1);
    }
  };

  return (
    <div className="tour-overlay">
      <div className="tour-modal" role="dialog" aria-modal="true" aria-label={current.title}>

        <div className="tour-image">
          {current.image ? (
            <img src={current.image} alt={current.title} />
          ) : (
            <div className="tour-placeholder">🏸</div>
          )}
        </div>

        <h2>{current.title}</h2>

        <div className="tour-description">
            {current.description.map((line, index) => (
                <p key={index}>{line}</p>
            ))}
        </div>

        <div className="tour-dots" aria-label={`Step ${page + 1} of ${pages.length}`}>
          {pages.map((_, index) => (
            <span
              key={index}
              className={`tour-dot ${
                index === page ? "active" : ""
              }`}
            />
          ))}
        </div>

        <div className="tour-footer">

          <button
            className="tour-btn secondary"
            onClick={onClose}
          >
            Skip
          </button>

          <div className="tour-nav">

            <button
              className="tour-btn secondary"
              disabled={isFirst}
              onClick={handlePrevious}
            >
              Previous
            </button>

            <button
              className="tour-btn primary"
              onClick={handleNext}
            >
              {isLast ? "Get Started" : "Next"}
            </button>

          </div>

        </div>

      </div>
    </div>
  );
}
