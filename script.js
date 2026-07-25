document.addEventListener('DOMContentLoaded', () => {
    initTypewriter();
    initMobileNav();
    initBackgroundParallax();
});

function initTypewriter() {
    const typedElement = document.getElementById('typed');
    if (!typedElement) return;
    const typedTextElement = typedElement;

    const phrases = [
        'Rokunujjaman',
        'an AI & ML researcher',
        'a competitive programmer',
        'a student at SUST',
        'a movie lover, cat fonder, reddit mod'
    ];

    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    const typeSpeed = 80;
    const deleteSpeed = 40;
    const pauseDelay = 2000;
    const endPauseDelay = 500;

    function typeStep() {
        const currentPhrase = phrases[phraseIndex];

        if (isDeleting) {
            typedTextElement.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
        } else {
            typedTextElement.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
        }

        let currentDelay = isDeleting ? deleteSpeed : typeSpeed;

        if (!isDeleting && charIndex === currentPhrase.length) {
            currentDelay = pauseDelay;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            currentDelay = endPauseDelay;
        }

        setTimeout(typeStep, currentDelay);
    }

    typeStep();
}

function initMobileNav() {
    const toggleBtn = document.getElementById('menu-toggle');
    const navCollapse = document.getElementById('navbar-collapse');

    if (toggleBtn && navCollapse) {
        toggleBtn.addEventListener('click', () => {
            const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
            toggleBtn.setAttribute('aria-expanded', String(!isExpanded));
            navCollapse.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            const target = e.target;
            if (target instanceof Node && !toggleBtn.contains(target) && !navCollapse.contains(target)) {
                navCollapse.classList.remove('show');
                toggleBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
}

function initBackgroundParallax() {
    const heroSection = (id) => document.getElementById(id);
    const hero = heroSection('hero-section');
    if (!hero) return;

    hero.addEventListener('mousemove', (e) => {
        const { clientX, clientY } = e;
        const moveX = (clientX - window.innerWidth / 2) * 0.015;
        const moveY = (clientY - window.innerHeight / 2) * 0.015;

        hero.style.backgroundPosition = `calc(50% + ${moveX}px) calc(50% + ${moveY}px)`;
    });
}