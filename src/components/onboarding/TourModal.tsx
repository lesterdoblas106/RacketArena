import {useEffect, useState } from "react";
import "./TourModal.css";
import { tourPages } from "./tourData";

interface TourModalProps {
  open: boolean;
  startPage: number;
  onClose: () => void;
}

export default function TourModal({
  open,
  startPage,
  onClose,
}: TourModalProps) {
  const [page, setPage] = useState(startPage);

  useEffect(() => {
  if (open) {
    setPage(startPage);
  }
}, [open, startPage]);

  if (!open) return null;

  const current = tourPages[page];
  const isFirst = page === 0;
  const isLast = page === tourPages.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem("tourCompleted", "true");
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

  const handleSkip = () => {
    localStorage.setItem("tourCompleted", "true");
    onClose();
  };

  return (
    <div className="tour-overlay">
      <div className="tour-modal">

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

        <div className="tour-dots">
          {tourPages.map((_, index) => (
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
            onClick={handleSkip}
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