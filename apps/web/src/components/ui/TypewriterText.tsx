/** One-shot heading reveal with immediately available accessible text and stable final geometry. */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import styles from './ui.module.css';
import { reportError } from '../../errors/index.js';
export interface TypewriterTextProps {
  text: string;
  breakAt?: number;
  intervalMs?: number;
  id?: string;
  className?: string;
}
/** Reveals one immutable phrase per mount; reduced motion and timer failure show the complete text. */
export function TypewriterText({
  text,
  breakAt,
  intervalMs = 45,
  id,
  className = '',
}: TypewriterTextProps) {
  const reduced = useReducedMotion();
  const limited =
    typeof navigator !== 'undefined' &&
    navigator.hardwareConcurrency > 0 &&
    navigator.hardwareConcurrency <= 2;
  const [count, setCount] = useState(0);
  const revealed = useRef(0);
  const staticText = reduced || limited;
  useEffect(() => {
    let active = true;
    if (staticText) {
      revealed.current = text.length;
      // Retain the finished phrase if the user later turns reduced motion off.
      queueMicrotask(() => {
        if (active) setCount(text.length);
      });
      return () => {
        active = false;
      };
    }
    if (revealed.current >= text.length) return;
    let timer: number | undefined;
    try {
      timer = window.setInterval(
        () => {
          revealed.current += 1;
          setCount(revealed.current);
          if (revealed.current >= text.length) window.clearInterval(timer);
        },
        Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 45,
      );
    } catch (error: unknown) {
      reportError(error, 'hero.heading');
      revealed.current = text.length;
      queueMicrotask(() => {
        if (active) setCount(text.length);
      });
    }
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [text, intervalMs, staticText]);
  const split = (value: string) =>
    breakAt === undefined ? (
      value
    ) : (
      <>
        {value.slice(0, breakAt)}
        <br />
        {value.slice(breakAt).trimStart()}
      </>
    );
  return (
    <h1 id={id} aria-label={text} className={`${styles.typewriter} ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className={styles.typewriterReserve}>
        {split(text)}
      </span>
      <span
        aria-hidden="true"
        className={styles.typewriterReveal}
        data-reveal-complete={staticText || count >= text.length}
      >
        {split(text.slice(0, staticText ? text.length : count))}
      </span>
    </h1>
  );
}
