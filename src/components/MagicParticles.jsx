import { useEffect, useRef } from "react";

export default function MagicParticles() {
    const containerRef = useRef(null);
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current || !containerRef.current) return;

        const container = containerRef.current;
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < 40; i++) { 
            const duration = 20 + Math.random() * 30;
            const delay = -(Math.random() * 25);
            const left = Math.random() * 100;
            const top = 110 + Math.random() * 50;

            const particle = document.createElement("div");
            particle.className = "magic-particle";
            particle.style.cssText = `
    --duration: ${duration}s;
    --delay: ${delay}s;
    --left: ${left}%;
    --top: ${top}vh;
  `;

            fragment.appendChild(particle);
        }

        container.appendChild(fragment);
        initialized.current = true;
    }, []);

    return <div className="magic-particles-container" ref={containerRef} />;
}