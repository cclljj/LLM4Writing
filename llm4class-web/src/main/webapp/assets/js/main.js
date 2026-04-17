(function ($) {
    "use strict";

    /* Windows Load */
    $(window).on('load', function () {
        preLoader();
        wowAnimation();
    });

    /* Preloader activation */
    function preLoader() {
        $('#loading').delay(500).fadeOut(500);
    };

    /* Wow Active */
    function wowAnimation() {
        var wow = new WOW({
            boxClass: 'wow',
            animateClass: 'animated',
            offset: 0,
            mobile: false,
            live: true
        });
        wow.init();
    }

    /* footer year */
    var yearElement = document.getElementById("year");
    if (yearElement) { yearElement.innerHTML = new Date().getFullYear(); }
    /* footer year */

    /* light dark activation start */
    function initThemeToggler() {
        const themeButton = document.getElementById('theme-button');

        if (!themeButton) return;

        // Set the theme based on localStorage or default to 'light'
        const savedTheme = localStorage.getItem('bd_theme_scheme') || 'dark';
        document.documentElement.setAttribute('data-theme-mode', savedTheme);

        // Update the icon based on the current theme
        updateThemeIcon(savedTheme);

        // Toggle theme on button click
        themeButton.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme-mode');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            // Save the new theme to localStorage
            localStorage.setItem('bd_theme_scheme', newTheme);

            // Update the data-theme-mode attribute
            document.documentElement.setAttribute('data-theme-mode', newTheme);

            // Update the icon
            updateThemeIcon(newTheme);
        });

        // Helper function to update the theme icon
        function updateThemeIcon(theme) {
            if (theme === 'dark') {
                themeButton.classList.remove('ri-sun-line');
                themeButton.classList.add('ri-moon-line');
            } else {
                themeButton.classList.remove('ri-moon-line');
                themeButton.classList.add('ri-sun-line');
            }
        }
    }

    initThemeToggler();
    /* light dark activation end */

    /* Sidebar Toggle */
    $(".offcanvas-close,.offcanvas-overlay").on("click", function () {
        $(".offcanvas-area").removeClass("info-open");
        $(".offcanvas-overlay").removeClass("overlay-open");
    });
    $(".sidebar-toggle").on("click", function () {
        $(".offcanvas-area").addClass("info-open");
        $(".offcanvas-overlay").addClass("overlay-open");
    });

    /* Body overlay Js */
    $(".body-overlay").on("click", function () {
        $(".offcanvas-area").removeClass("opened");
        $(".body-overlay").removeClass("opened");
    });

    /* Sticky Header Js */
    $(window).on("scroll", function () {
        if ($(this).scrollTop() > 250) {
            $("#header-sticky").addClass("bd-sticky");
        } else {
            $("#header-sticky").removeClass("bd-sticky");
        }
    });

    /* Data Css js */
    $("[data-background").each(function () {
        $(this).css(
            "background-image",
            "url( " + $(this).attr("data-background") + "  )"
        );
    });

    $("[data-width]").each(function () {
        $(this).css("width", $(this).attr("data-width"));
    });

    $("[data-bg-color]").each(function () {
        $(this).css("background-color", $(this).attr("data-bg-color"));
    });

    /* MagnificPopup image view */
    $(".popup-image").magnificPopup({
        type: "image",
        gallery: {
            enabled: true,
        },
    });

    /* MagnificPopup video view */
    $(".popup-video").magnificPopup({
        type: "iframe",
    });

    /* Nice Select Js */
    $(".bd-sorting-select,.app-profile-sorting, .input-box-select").niceSelect();

    /* Button scroll up js */
    // var progressPath = document.querySelector(".backtotop-wrap path");
    // var pathLength = progressPath.getTotalLength();
    // progressPath.style.transition = progressPath.style.WebkitTransition = "none";
    // progressPath.style.strokeDasharray = pathLength + " " + pathLength;
    // progressPath.style.strokeDashoffset = pathLength;
    // progressPath.getBoundingClientRect();
    // progressPath.style.transition = progressPath.style.WebkitTransition = "stroke-dashoffset 10ms linear";
    // var updateProgress = function () {
    //     var scroll = $(window).scrollTop();
    //     var height = $(document).height() - $(window).height();
    //     var progress = pathLength - (scroll * pathLength) / height;
    //     progressPath.style.strokeDashoffset = progress;
    // };
    // updateProgress();
    // $(window).scroll(updateProgress);
    // var offset = 150;
    // var duration = 550;
    // jQuery(window).on("scroll", function () {
    //     if (jQuery(this).scrollTop() > offset) {
    //         jQuery(".backtotop-wrap").addClass("active-progress");
    //     } else {
    //         jQuery(".backtotop-wrap").removeClass("active-progress");
    //     }
    // });
    // jQuery(".backtotop-wrap").on("click", function (event) {
    //     event.preventDefault();
    //     jQuery("html, body").animate({
    //         scrollTop: 0
    //     }, parseInt(duration, 10)); // Fixing parseInt call with radix parameter
    //     return false;
    // });

    /* PureCounter Js */
    new PureCounter();
    new PureCounter({
        filesizing: true,
        selector: ".filesizecount",
        pulse: 2,
    });

    /* Menu nav activation */
    document.addEventListener('DOMContentLoaded', function () {
        var pgurl = window.location.href.substr(window.location.href.lastIndexOf("/") + 1);
        const navLinks = document.querySelectorAll('.main-menu ul li a');
        navLinks.forEach(link => {
            if (link.getAttribute('href') === pgurl || link.getAttribute('href') === '') {
                link.classList.add('active');
                let parent = link.closest('li');
                while (parent) {
                    const parentLink = parent.querySelector('a');
                    if (parentLink && !parentLink.classList.contains('active')) {
                        parentLink.classList.add('active');
                    }
                    parent = parent.closest('ul')?.closest('li');
                }
            }
        });
    });
    /* Mobile Menu Js */
    $(document).ready(function () {
        var bdMenuWrap = $('.bd-mobile-menu-active > ul').clone();
        var bdSideMenu = $('.bd-offcanvas-menu nav');
        bdSideMenu.append(bdMenuWrap);
        if ($(bdSideMenu).find('.submenu, .mega-menu').length != 0) {
            $(bdSideMenu).find('.submenu, .mega-menu').parent().append('<button class="bd-menu-close"><i class="ri-arrow-right-s-line"></i></button>');
        }
        var sideMenuList = $('.bd-offcanvas-menu nav > ul > li button.bd-menu-close, .bd-offcanvas-menu nav > ul li.has-dropdown > a');
        $(sideMenuList).on('click', function (e) {
            e.preventDefault();
            var $this = $(this).parent();
            var $siblings = $this.siblings('li');
            if (!$this.hasClass('active')) {
                /* Close all active submenus */
                $('.bd-offcanvas-menu nav > ul > li> ul > li.active').removeClass('active').children('.submenu, .mega-menu').slideUp();
                /* Open the clicked submenu */
                $this.addClass('active').children('.submenu, .mega-menu').slideDown();
                /* Close the sibling submenus */
                $siblings.removeClass('active').children('.submenu, .mega-menu').slideUp();
            } else {
                /* Close the clicked submenu */
                $this.removeClass('active').children('.submenu, .mega-menu').slideUp();
            }
        });
        /* Sidebar toggle */
        $('.sidebar-toggle .bar-icon').on('click', function () {
            $('.bd-offcanvas-menu').toggleClass('active');
        });
    });

    /* Sidebar Toggle */
    $(".bd-offcanvas-close,.bd-offcanvas-overlay").on("click", function () {
        $(".bd-offcanvas-area").removeClass("info-open");
        $(".bd-offcanvas-overlay").removeClass("overlay-open");
    });
    $(".sidebar-toggle").on("click", function () {
        $(".bd-offcanvas-area").addClass("info-open");
        $(".bd-offcanvas-overlay").addClass("overlay-open");
    });

    /* Body overlay Js */
    $(".body-overlay").on("click", function () {
        $(".bd-offcanvas-area").removeClass("opened");
        $(".body-overlay").removeClass("opened");
    });

    /* Flashlight Effect  */
    document.querySelectorAll(".light-effect").forEach((element) => {
        element.addEventListener("mousemove", (e) => {
            const rect = element.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            element.style.setProperty("--x", `${x}px`);
            element.style.setProperty("--y", `${y}px`);
        });
    });


    /* kindergarten program activation */
    var currentBidActive = new Swiper(".currentBidActive", {
        slidesPerView: 3,
        spaceBetween: 30,
        centeredSlides: false,
        loop: true,
        allowTouchMove: true,
        observer: true,
        autoplay: true,
        navigation: {
            nextEl: ".blog-navigation-next",
            prevEl: ".blog-navigation-prev",
        },
        breakpoints: {
            1400: {
                slidesPerView: 3,
            },
            1200: {
                slidesPerView: 3,
            },
            992: {
                slidesPerView: 2,
            },
            768: {
                slidesPerView: 2,
            },
            576: {
                slidesPerView: 1,
            },
            0: {
                slidesPerView: 1,
            },
        },
    });

    /* Sidebar js */

    $("#sidebarToggle").on("click", function () {
        if (window.innerWidth > 0 && window.innerWidth <= 1199) {
            $(".app-sidebar").toggleClass("close_sidebar");
        } else {
            $(".app-sidebar").toggleClass("collapsed");
        }
        $(".app__offcanvas-overlay").toggleClass("overlay-open");
    });
    $(".app__offcanvas-overlay").on("click", function () {
        $(".app-sidebar").removeClass("collapsed");
        $(".app-sidebar").removeClass("close_sidebar");
        $(".app__offcanvas-overlay").removeClass("overlay-open");
    });

    /* Dashboard Sidebar nav activation */
    document.addEventListener('DOMContentLoaded', function () {
        var pgurl = window.location.href.substr(window.location.href.lastIndexOf("/") + 1);
        const navLinks = document.querySelectorAll('.app-profile-menu ul li a');
        navLinks.forEach(link => {
            if (link.getAttribute('href') === pgurl || link.getAttribute('href') === '') {
                link.classList.add('active');
            }
        });
    });

    /* toggle switches */
    let customSwitch = document.querySelectorAll(".bd-toggle");
    customSwitch.forEach((e) =>
        e.addEventListener("click", () => {
            e.classList.toggle("on");
        })
    );
    /* toggle switches */

    /* countdown activation start */
    $(document).ready(function () {
        function makeTimer(endTime, countdownElementId) {
            var now = new Date();
            now = (Date.parse(now) / 1000);
            var timeLeft = endTime - now;
            if (timeLeft <= 0) {
                clearInterval(timerInterval); // Stop the timer
                $("#" + countdownElementId + " [data-unit='days']").html("00<span>Days</span>");
                $("#" + countdownElementId + " [data-unit='hours']").html("00<span>Hours</span>");
                $("#" + countdownElementId + " [data-unit='minutes']").html("00<span>Minutes</span>");
                $("#" + countdownElementId + " [data-unit='seconds']").html("00<span>Seconds</span>");
                return;
            }
            var days = Math.floor(timeLeft / 86400);
            var hours = Math.floor((timeLeft - (days * 86400)) / 3600);
            var minutes = Math.floor((timeLeft - (days * 86400) - (hours * 3600)) / 60);
            var seconds = Math.floor((timeLeft - (days * 86400) - (hours * 3600) - (minutes * 60)));
            if (hours < "10") { hours = "0" + hours; }
            if (minutes < "10") { minutes = "0" + minutes; }
            if (seconds < "10") { seconds = "0" + seconds; }
            $("#" + countdownElementId + " [data-unit='days']").html(days + "<span>Days</span>");
            $("#" + countdownElementId + " [data-unit='hours']").html(hours + "<span>Hours</span>");
            $("#" + countdownElementId + " [data-unit='minutes']").html(minutes + "<span>Minutes</span>");
            $("#" + countdownElementId + " [data-unit='seconds']").html(seconds + "<span>Seconds</span>");
        }
        var endTime = new Date("5 August 2025 14:00:00 GMT+06:00");
        endTime = (Date.parse(endTime) / 1000);
        var timerInterval = setInterval(function () {
            makeTimer(endTime, "countdown1");
            makeTimer(endTime, "countdown2");
            makeTimer(endTime, "countdown3");
            makeTimer(endTime, "countdown4");
            makeTimer(endTime, "countdown5");
        }, 1000);
    });
    /* countdown activation end */

    /* pricing plan change js */
    document.addEventListener("DOMContentLoaded", function () {
        const yearlyBtn = document.querySelector('.yearly-plan-btn');
        const monthlyBtn = document.querySelector('.monthly-plan-btn');
        const yearlyPricing = document.querySelectorAll('.yearly-pricing');
        const monthlyPricing = document.querySelectorAll('.monthly-pricing');
        if (yearlyBtn && monthlyBtn) {
            /* Show Yearly Pricing */
            yearlyBtn.addEventListener('click', function () {
                yearlyBtn.classList.add('active');
                monthlyBtn.classList.remove('active');
                yearlyPricing.forEach(el => (el.style.display = 'block'));
                monthlyPricing.forEach(el => (el.style.display = 'none'));
            });

            /* Show Monthly Pricing */
            monthlyBtn.addEventListener('click', function () {
                monthlyBtn.classList.add('active');
                yearlyBtn.classList.remove('active');
                yearlyPricing.forEach(el => (el.style.display = 'none'));
                monthlyPricing.forEach(el => (el.style.display = 'block'));
            });
        }
    });

    /* Blog Similar Post Slider */
    var articlesActivation = new Swiper(".articlesActivation", {
        slidesPerView: 3,
        spaceBetween: 30,
        centeredSlides: false,
        loop: true,
        allowTouchMove: true,
        observer: true,
        navigation: {
            nextEl: ".blog-navigation-next",
            prevEl: ".blog-navigation-prev",
        },
        breakpoints: {
            1400: {
                slidesPerView: 3,
            },
            1200: {
                slidesPerView: 3,
            },
            992: {
                slidesPerView: 2,
            },
            768: {
                slidesPerView: 2,
            },
            576: {
                slidesPerView: 1,
            },
            0: {
                slidesPerView: 1,
            },
        },
    });

    document.addEventListener("DOMContentLoaded", function () {
        const closeButton = document.querySelector('.bd-header-top-close-btn');
        if (closeButton) {
            closeButton.addEventListener('click', function () {
                const headerTopNews = document.querySelector('.bd-header-top-bar');
                if (headerTopNews) {
                    headerTopNews.remove();
                }
            });
        }
    });

})(jQuery);