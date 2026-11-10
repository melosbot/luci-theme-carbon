#!/usr/bin/env python3
"""
Generate htdocs/luci-static/carbon/brands.js — brand icons + device
recognition data for the dashboard's "Connected Devices" list.

Sources (downloaded into a cache dir, nothing is executed from them):
  * Simple Icons  (CC0 1.0)  https://simpleicons.org  — brand glyph paths
  * IEEE MA-L OUI registry   https://standards-oui.ieee.org/oui/oui.csv

Usage:  python3 -I scripts/gen-brands.py [cache-dir]
"""
import base64
import csv
import json
import os
import re
import sys
import urllib.request

SI_VERSION = "16.37.0"
SI_BASE = f"https://cdn.jsdelivr.net/npm/simple-icons@{SI_VERSION}"
OUI_URL = "https://standards-oui.ieee.org/oui/oui.csv"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "htdocs", "luci-static", "carbon", "brands.js")
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, ".cache", "brands")

# key: (display name, avatar style, OUI organisation regex or None)
#   avatar style: ("icon", simple-icons slug, bg, fg)
#                 ("mono", letter, bg, fg)
#                 ("glyph", carbon icon name, bg)
# bg/fg may be CSS values; "INV" = inverted neutral (dark on light theme,
# light on dark theme) for brands whose colour is black or white.
# Word marks that Simple Icons does not ship. Each entry is the viewBox and a
# single monochrome path taken from the official logo, credited below.
#   TCL   — TCL word mark
#   Midea — Midea word mark
#   Haier — Haier word mark
CUSTOM_ICONS = {
    "tcl": ("0 0 2499.3 779.6", "m1718.1 468.9h-220.4c-6.4 1.6-3.1.8-7.4 18.3-10.8 45.3-39.3 82.8-84.8 101.5-52.5 21.4-127.8 21.1-178.7-1.5-112.6-50.1-137.5-193.8-98-291.8 19.6-48.8 56.6-86.6 105.4-105.9 51.6-20.5 129.9-18.5 178.2 4.7 44.7 21.6 68.6 59.4 77.9 106.4 2.6 12.9 1.6 11.1 15.4 11 69.7-.8 141.7 2.1 211-.3 3.3-47.3-23.2-114.4-43.2-146.1-24.7-39.1-57.9-71.7-96.6-96.2-91.9-58.3-187.8-75.4-317.6-67-120 7.7-210.6 50.9-273 111.3-136.8 132.7-151.3 409.3.5 552l24.9 22.7c65.6 55.6 161.2 82.5 248.3 89.4 117.7 9.3 233.9-10.5 315.7-64.3 66.4-43.7 136-126.3 142.4-244.5zm-1718.1-225 283 .2.3 507.2 252.8.2.5-507 282.8-.3v-204.4l-818.6-.7zm1853.7 507.3 644 .5c2.3-16 2.1-187.2-.7-195.9l-398.7-.3v-516.2l-244.3-.7c-3.6 18.8-1.1 560.7-1.1 623.7 0 23.1-2.5 68.6 1 89z m1855 749.2h640.4l.7-190.5c-26.8-.2-383 2.5-397.8-1.5-2.1-4.9-2-2.8-2-9v-507.3h-241.3l-.2 708.1z"),
    "midea": ("-1 0 3229 1244", "M1481 609v446h105V609zm-189-170h-108c-12 0-10 11-10 11 2 14 5 37 5 85 0 106-13 258-129 403l-8 10s-70-488-71-497c0 0 0-11-10-11H852c-10 0-10 11-10 11-3 56-34 526-377 602 73 8 161-15 238-62 95-59 159-146 180-246 0 0 42 262 47 322v4l-3 2c-96 51-205 79-314 79-270 0-509-160-614-404 62 287 318 496 617 496 349 0 557-292 593-500 0 0 47 303 48 313h143c-2-13-97-595-98-604 0 0 0-11-10-11zM83 694c0-320 270-580 601-580 205 0 396 103 507 270C1110 156 884 0 631 0 304 0 38 255 38 568c0 86 21 170 60 247-9-39-15-80-15-120zm2506-21c-38-44-91-67-155-67-65 0-120 21-164 63-43 41-65 96-65 164 0 67 21 121 63 161s103 60 179 60c148 0 180-102 192-135l-38-12c-34 62-110 66-155 63-32-2-61-13-84-29-23-17-39-41-46-78l-2-14h332c-1-73-20-132-57-175zm-267 113c-5 0-5-5-5-7 4-26 14-46 32-64 20-21 51-33 84-33 30 0 54 9 75 26 17 15 29 36 36 65 1 3 3 12-5 12h-217zm601-182c-126 0-171 77-185 113 0 1-5 13-5 13l42 14s27-78 134-73c108 4 95 93 95 107-60-18-145-16-201 9-70 32-81 96-78 143 3 70 65 119 145 123 72 4 104-12 134-41l-1 41h95V746c2-53-35-143-175-143zm80 346c0 7-2 12-8 15-18 9-56 21-103 18-49-4-68-39-71-54-1-6-12-71 51-91 41-13 93-5 121 3 8 2 10 7 10 17v93zM1579 439h-87c-13 0-11 13-11 13v94h107v-95s1-11-10-11zm534 0h-89c-9 0-9 10-9 10v183l-13-7c-14-7-28-12-43-15s-33-4-53-4c-70 0-127 20-169 61-41 40-63 98-63 169 0 63 18 116 53 158 35 41 86 62 153 62 96 0 134-58 134-58v56h108V949 450s0-11-9-11zm-104 494c-10 9-23 16-39 22-17 7-37 10-59 10-36 0-65-12-86-36s-31-59-31-106c0-46 10-80 29-101 20-22 50-33 90-33 21 0 41 3 59 10 16 6 28 12 37 20 3 3 6 8 6 15v183c0 7-3 12-6 15zM3163 365c-37 0-65 28-65 65 0 36 28 65 65 65s65-28 65-65c0-36-28-65-65-65zm0 9c31 0 55 25 55 56s-23 56-55 56c-31 0-55-25-55-56s23-56 55-56zm-14 60h16l21 33h11l-22-33c10-2 19-8 19-21s-7-21-24-21h-29v75h9v-33zm0-8v-26h17c9 0 18 2 18 13 0 13-11 13-22 13h-12z"),
    "haier": ("24.291 6.758 792.779 244.177", "m712.652 171.532c.348-3.178.552-6.388.552-9.638 0-49.205-40.776-89.07-91.083-89.07-50.293 0-91.063 39.865-91.063 89.07 0 49.189 40.771 89.039 91.063 89.039 38.259 0 70.963-23.021 84.481-55.729l-39.257-6.878c-8.696 15.914-25.151 26.634-43.96 26.634-24.967 0-45.642-18.778-49.801-43.429h139.068zm-89.266-61.742c21.319 0 39.528 13.729 46.96 33.163h-93.977c7.412-19.433 25.661-33.163 47.017-33.163zm-163.32-33.235h46.512v171.18h-46.512zm23.273-69.797c-14.358 0-25.95 11.655-25.95 25.953 0 14.276 11.592 25.9 25.95 25.9 14.3 0 25.917-11.624 25.917-25.9 0-14.298-11.617-25.953-25.917-25.953m-307.95 14.913v92.151h-100.256v-92.151h-50.842v225.911h50.842v-92.155h100.256v92.155h50.884v-225.911zm209.929 54.963v9.185c-13.519-8.191-29.361-12.896-46.336-12.896-49.308 0-89.3 39.84-89.3 89.006 0 49.156 39.992 89.006 89.3 89.006a89.237 89.237 0 0 0 45.262-12.27v8.918h45.384v-170.949zm-44.068 136.774c-28.777 0-52.04-23.027-52.04-51.459 0-28.456 23.262-51.5 52.04-51.5 28.77 0 52.071 23.044 52.071 51.5-.001 28.432-23.302 51.459-52.071 51.459zm468.126-152.751c-42.832 7.472-75.396 44.736-75.896 89.679v97.398h44.535l.023-99.229c0-22.716 17.053-41.463 39.032-44.153z"),
    "brother": ("0.038 0.034 2.605809061125626 0.5923850260083584", "M2.565.138c-.146 0-.224.082-.227.188a.233.233 0 0 0-.233-.19.23.23 0 0 0-.23.188.186.186 0 0 0-.183-.188.162.162 0 0 0-.115.047V.035h-.11v.33l-.001.033C1.459.466 1.413.5 1.363.5c-.052 0-.1-.024-.1-.102L1.26.37V.247h.171V.143h-.17V.035H1.15v.29A.235.235 0 0 0 .738.222V.138H.725C.582.138.505.218.5.32A.221.221 0 0 0 .282.138a.186.186 0 0 0-.137.056v-.16H.038V.37C.04.5.13.604.27.604.39.604.477.526.5.422v.171h.11V.38.35C.613.282.655.243.723.242a.235.235 0 1 0 .428.172c0 .114.09.19.2.19.046 0 .086-.02.117-.052v.04h.11V.36.346c.003-.075.047-.107.095-.107s.09.032.09.106l.001.018v.23h.112V.42c.02.112.116.185.23.185a.216.216 0 0 0 .221-.169h-.108a.119.119 0 0 1-.113.078c-.06 0-.111-.04-.124-.108h.357v.188h.11V.38L2.45.35c.002-.067.046-.106.116-.106h.012V.138h-.012zM.269.498A.127.127 0 0 1 .141.37C.141.3.197.242.27.242c.073 0 .129.056.129.128a.127.127 0 0 1-.129.128zm.65 0A.127.127 0 0 1 .793.37C.792.3.847.242.92.242c.073 0 .128.056.128.128A.127.127 0 0 1 .92.498zm1.067-.18a.125.125 0 0 1 .119-.09c.07 0 .11.056.119.09zM2.526.545c0 .03.025.055.055.055a.055.055 0 1 0 0-.11.055.055 0 0 0-.055.055zm.007 0a.048.048 0 1 1 .096 0 .048.048 0 0 1-.096 0z M2.565.52h.022c.009 0 .012.004.012.011 0 .008-.003.012-.012.012h-.022V.52zm0 .03h.022c.006 0 .01.005.01.013V.57L2.6.578h.01V.577L2.606.569V.56C2.605.554 2.602.549 2.598.547c.006-.002.01-.008.01-.017 0-.01-.007-.018-.02-.018h-.032v.066h.009V.551z"),
    "xikestor": ("0 0 24 24", "M 14.180 0.161 c -0.064 0.086 -0.150 0.364 -0.182 0.611 -0.086 0.804 -0.139 0.943 -0.343 0.943 -0.107 -0.000 -0.311 -0.086 -0.450 -0.204 -0.225 -0.171 -0.407 -0.193 -1.383 -0.161 -1.308 0.054 -1.447 0.139 -1.350 0.847 0.075 0.493 0.021 0.600 -0.397 0.772 -0.407 0.193 -0.740 0.750 -0.686 1.211 0.032 0.311 -0.021 0.429 -0.375 0.761 -0.268 0.247 -0.407 0.482 -0.407 0.654 0.000 0.300 -0.171 0.407 -0.611 0.407 -0.439 -0.000 -1.200 0.493 -1.275 0.836 -0.032 0.161 -0.107 0.397 -0.161 0.536 -0.139 0.343 -0.118 0.815 0.032 0.965 0.075 0.075 0.439 0.129 0.900 0.129 0.665 -0.000 0.825 -0.032 1.083 -0.257 0.171 -0.150 0.407 -0.461 0.514 -0.697 0.107 -0.247 0.236 -0.439 0.279 -0.439 0.161 -0.000 2.144 -1.961 2.304 -2.283 0.139 -0.257 0.139 -0.332 -0.011 -0.611 -0.236 -0.461 -0.204 -0.697 0.204 -1.115 0.429 -0.461 0.815 -0.514 0.815 -0.129 0.000 0.171 0.161 0.386 0.493 0.665 0.472 0.407 0.493 0.439 0.600 1.275 0.086 0.643 0.182 0.932 0.375 1.168 0.139 0.171 0.461 0.707 0.697 1.179 0.236 0.482 0.493 0.900 0.557 0.943 0.064 0.043 0.354 0.086 0.632 0.086 0.482 -0.000 0.525 0.021 0.665 0.354 0.086 0.204 0.214 0.418 0.300 0.493 0.214 0.171 0.900 0.054 1.426 -0.247 0.879 -0.493 0.879 -1.179 0.011 -1.554 -0.825 -0.354 -1.436 -1.501 -1.018 -1.919 0.107 -0.107 0.021 -0.236 -0.364 -0.590 -0.579 -0.536 -0.740 -0.879 -0.654 -1.404 0.032 -0.214 -0.011 -0.579 -0.118 -0.879 -0.096 -0.279 -0.171 -0.643 -0.171 -0.793 0.000 -0.364 -0.343 -0.815 -0.697 -0.900 -0.150 -0.043 -0.268 -0.107 -0.268 -0.161 0.000 -0.150 -0.514 -0.654 -0.675 -0.654 -0.086 -0.000 -0.214 0.075 -0.289 0.161 z M 8.049 10.707 c -0.225 0.129 -0.525 0.225 -0.675 0.225 -0.354 -0.000 -0.697 0.354 -0.697 0.729 0.000 0.386 0.279 0.772 0.547 0.772 0.129 -0.000 0.343 0.096 0.493 0.214 0.171 0.129 0.439 0.214 0.697 0.214 0.268 -0.000 0.536 0.086 0.697 0.214 0.364 0.289 0.611 0.268 0.932 -0.054 0.300 -0.300 0.472 -0.322 0.836 -0.150 0.257 0.129 1.050 1.083 1.050 1.275 0.000 0.064 0.139 0.386 0.311 0.729 0.171 0.354 0.332 0.868 0.364 1.233 0.032 0.343 0.139 0.750 0.236 0.890 0.225 0.343 0.064 0.579 -0.397 0.579 -0.375 -0.000 -0.890 0.461 -0.804 0.729 0.032 0.096 0.118 0.332 0.193 0.525 0.129 0.311 0.118 0.364 -0.107 0.611 -0.407 0.429 -1.265 0.740 -1.994 0.729 -1.190 -0.032 -1.393 -0.021 -2.004 0.043 -0.804 0.086 -0.986 0.289 -1.050 1.211 -0.043 0.632 -0.075 0.707 -0.289 0.740 -0.139 0.021 -0.386 -0.064 -0.568 -0.193 -0.171 -0.129 -0.482 -0.257 -0.675 -0.289 -0.300 -0.043 -0.429 -0.000 -0.750 0.289 -0.214 0.182 -0.418 0.429 -0.450 0.547 -0.086 0.279 0.214 0.632 0.536 0.632 0.139 -0.000 0.364 0.161 0.579 0.429 0.407 0.504 0.718 0.547 1.083 0.161 0.257 -0.279 0.579 -0.354 0.697 -0.161 0.161 0.268 1.233 0.032 1.233 -0.268 0.000 -0.236 1.136 -0.729 1.501 -0.665 0.182 0.043 0.429 -0.043 0.750 -0.247 0.332 -0.204 0.697 -0.322 1.158 -0.375 0.547 -0.064 0.761 -0.139 1.050 -0.397 0.204 -0.182 0.364 -0.429 0.364 -0.557 0.000 -0.300 0.975 -1.350 1.265 -1.350 0.118 -0.000 0.257 0.043 0.289 0.107 0.086 0.139 0.547 0.139 0.815 -0.000 0.257 -0.139 0.279 -0.772 0.043 -0.965 -0.332 -0.268 -0.590 -0.729 -0.525 -0.911 0.043 -0.096 0.332 -0.322 0.654 -0.504 0.322 -0.182 0.611 -0.397 0.643 -0.493 0.043 -0.086 -0.086 -0.289 -0.332 -0.514 -0.311 -0.289 -0.386 -0.429 -0.386 -0.761 0.011 -0.225 0.075 -0.525 0.161 -0.675 0.086 -0.150 0.150 -0.547 0.161 -0.879 0.000 -0.729 0.118 -0.825 1.061 -0.911 0.568 -0.054 0.632 -0.032 1.072 0.332 0.247 0.214 0.557 0.386 0.675 0.386 0.654 -0.000 1.586 -0.890 1.586 -1.522 0.000 -0.236 -0.075 -0.354 -0.343 -0.493 -0.193 -0.096 -0.482 -0.343 -0.665 -0.536 -0.257 -0.279 -0.397 -0.343 -0.750 -0.343 -0.397 -0.000 -1.383 -0.161 -2.658 -0.439 -0.364 -0.086 -0.568 -0.075 -0.740 0.011 -0.150 0.086 -0.450 0.107 -0.890 0.054 -0.364 -0.043 -0.890 -0.064 -1.190 -0.043 -0.986 0.054 -3.312 0.021 -3.859 -0.054 -0.439 -0.064 -0.611 -0.032 -0.932 0.139 z"),
    "windows": ("0 0 24 24", "M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"),
}

# Monochrome word marks: wide and short, so they get a larger box inside
# the avatar than the squarish symbol logos.
WORDMARKS = {"tcl", "midea", "haier", "brother"}

BRANDS = {
    "apple":       ("Apple",        ("icon", "apple", "INV"),                 r"^Apple, Inc"),
    "xiaomi":      ("Xiaomi",       ("icon", "xiaomi", "#FF6900"),           r"Xiaomi"),
    "huawei":      ("Huawei",       ("icon", "huawei", "#FF0000"),           r"Huawei|HUAWEI"),
    "honor":       ("Honor",        ("mono", "H", "INV"),                    r"Honor Device"),
    "samsung":     ("Samsung",      ("mono", "S", "#1428A0"),                r"^Samsung Electronics"),
    "oppo":        ("OPPO",         ("mono", "O", "#2D683D"),                r"Oppo|OPPO"),
    "vivo":        ("vivo",         ("mono", "v", "#415FFF"),                r"vivo Mobile"),
    "oneplus":     ("OnePlus",      ("icon", "oneplus", "#F5010C"),          r"OnePlus"),
    "realme":      ("realme",       ("mono", "r", "#FFC915", "#1d1d1f"),     r"Realme"),
    "meizu":       ("Meizu",        ("icon", "meizu", "#FF4132"),            None),
    "google":      ("Google",       ("icon", "google", "#4285F4"),           r"^Google"),
    "android":     ("Android",      ("icon", "android", "#3DDC84"),          None),
    "amazon":      ("Amazon",       ("glyph", "speaker", "#FF9900"),         r"^Amazon"),
    "nintendo":    ("Nintendo",     ("glyph", "gamepad", "#E60012"),         r"Nintendo"),
    "playstation": ("PlayStation",  ("icon", "playstation", "#0070D1"),      r"Sony Interactive"),
    "sony":        ("Sony",         ("mono", "S", "INV"),                    r"^Sony"),
    "microsoft":   ("Microsoft",    ("glyph", "pc", "#737373"),              r"^Microsoft"),
    "windows":     ("Windows",      ("icon", "windows", "#0078D4"),              None),
    "lenovo":      ("Lenovo",       ("mono", "L", "#E2231A"),                r"Lenovo"),
    "dell":        ("Dell",         ("icon", "dell", "#007DB8"),             r"^Dell"),
    "hp":          ("HP",           ("icon", "hp", "#0096D6"),               r"^HP |^Hewlett Packard|^HP Inc"),
    "asus":        ("ASUS",         ("mono", "A", "INV"),                    r"ASUSTek"),
    "tplink":      ("TP-Link",      ("icon", "tplink", "#4ACBD6"),           r"TP-LINK|TP-Link"),
    "raspberrypi": ("Raspberry Pi", ("icon", "raspberrypi", "#A22846"),      r"Raspberry Pi"),
    "synology":    ("Synology",     ("mono", "S", "#3A3A3C"),                r"Synology"),
    "espressif":   ("Espressif",    ("icon", "espressif", "#E7352C"),        r"Espressif"),
    "lg":          ("LG",           ("icon", "lg", "#A50034"),               r"^LG Electronics"),
    "roku":        ("Roku",         ("mono", "R", "#662D91"),                r"^Roku"),
    "dji":         ("DJI",          ("icon", "dji", "INV"),                  r"DJI"),
    "ubiquiti":    ("Ubiquiti",     ("icon", "ubiquiti", "#0559C9"),         r"Ubiquiti"),
    "philipshue":  ("Philips Hue",  ("icon", "philipshue", "#0065D3"),       r"Signify|Philips Lighting"),
    "zte":         ("ZTE",          ("mono", "Z", "#0081CC"),                r"^zte|ZTE Corporation"),
    "tcl":         ("TCL",          ("icon", "tcl", "#E4002B"),                r"^TCL"),
    "hisense":     ("Hisense",      ("mono", "H", "#00A99D"),                r"Hisense"),
    "midea":       ("Midea",        ("icon", "midea", "#03B0EF"),              r"Midea (Group|Air|Electric)"),
    "haier":       ("Haier",        ("icon", "haier", "#005AAB"),              r"Haier"),
    "proxmox":     ("Proxmox",      ("icon", "proxmox", "#E57000"),          r"Proxmox Server Solutions"),
    "debian":      ("Debian",       ("icon", "debian", "#A80030"),           r"^Debian"),
    "brother":     ("Brother",      ("icon", "brother", "#2566AF"),           r"Brother Industries"),
    "cisco":       ("Cisco",        ("icon", "cisco", "#1BA0D7"),            r"^Cisco Systems"),
    # vendor hints: no brand name shown, the avatar and the type come from
    # the glyph — an ONT/ONU is an optical modem, a Wi-Fi chip means a computer
    "_ont":        (None,           ("icon", "temporal", "#523BE4"),         r"Fiberhome", "modem"),
    "_switch":     (None,           ("icon", "xikestor", "#E50113"),         None, "switch"),
    "_pc":         (None,           ("glyph", "pc", None),                   r"^Intel Corporate|^Liteon|^AzureWave|^Realtek"),
}

# Hostname rules, first match wins: (regex, brand key or None, device type)
HOST_RULES = [
    (r"iphone", "apple", "phone"),
    (r"ipad", "apple", "tablet"),
    (r"macbook|imac|mac-?mini|mac-?pro|mac-?studio|^mac\b", "apple", "pc"),
    (r"apple-?tv|appletv", "apple", "tv"),
    (r"homepod", "apple", "speaker"),
    (r"apple-?watch|ipod|airport|apple", "apple", None),
    (r"redmi|xiaomi|^mi[-_ ]|^mi\d|poco|mijia|miwifi|xiaoai|zhimi|chuangmi|yeelink|lumi-|roborock|dreame|viomi|mibox|mitv", "xiaomi", None),
    (r"honor", "honor", "phone"),
    (r"huawei|matebook|matepad|harmony", "huawei", None),
    (r"samsung|galaxy|^sm-[a-z]\d", "samsung", None),
    (r"oneplus", "oneplus", "phone"),
    (r"realme|^rmx\d", "realme", "phone"),
    (r"oppo|^cph\d|^pd[a-z]m\d", "oppo", "phone"),
    (r"vivo|iqoo", "vivo", "phone"),
    (r"meizu", "meizu", "phone"),
    (r"pixel|chromecast|google|nest-?(hub|mini|audio|wifi)", "google", None),
    (r"echo|kindle|fire-?tv|amazon|alexa", "amazon", None),
    (r"nintendo", "nintendo", "game"),
    (r"playstation|^ps[345]\b|^ps[345]-", "playstation", "game"),
    (r"xbox", "microsoft", "game"),
    (r"^desktop-|^laptop-|^win-|windows|surface", "windows", "pc"),
    (r"bravia", "sony", "tv"),
    (r"lenovo|thinkpad|thinkbook|legion|yoga", "lenovo", "pc"),
    (r"dell|xps|inspiron|latitude|optiplex", "dell", "pc"),
    (r"^hp[-_]|hewlett|laserjet|deskjet|officejet|envy|pavilion|elitebook", "hp", None),
    (r"asus|rog-|zenbook|vivobook", "asus", None),
    (r"tp-?link|^tl-|deco", "tplink", None),
    (r"raspberry|^rpi|raspi", "raspberrypi", "pc"),
    (r"synology|diskstation|^ds\d{3}", "synology", "nas"),
    (r"proxmox|(^|[-_])pve($|[-_.])|^pve", "proxmox", "pc"),
    (r"^esp[-_]|esp32|esp8266|tasmota|espressif", "espressif", "iot"),
    (r"lgwebos|^lg[-_]", "lg", "tv"),
    (r"roku", "roku", "tv"),
    (r"dji", "dji", None),
    (r"unifi|ubnt|ubiquiti", "ubiquiti", None),
    (r"hue-?bridge|philips-?hue", "philipshue", "iot"),
    (r"hisense|vidaa", "hisense", "tv"),
    (r"tcl", "tcl", "tv"),
    (r"midea", "midea", "iot"),
    (r"haier", "haier", "iot"),
    (r"zte", "zte", None),
    (r"^android|android-", "android", "phone"),
    # brandless device types
    (r"brother", "brother", "printer"),
    (r"printer|epson|canon", None, "printer"),
    (r"camera|ipcam|^ipc|ezviz|hikvision|imou|xiaovv", None, "camera"),
    (r"tv\b|-tv|tv-|电视", None, "tv"),
    (r"speaker|sonos", None, "speaker"),
    (r"phone|手机", None, "phone"),
    (r"pad\b|tablet|平板", None, "tablet"),
    (r"home-?lab|debian", "debian", "nas"),
    (r"nas\b|^lab[-_]", None, "nas"),
    (r"switch|交换机|交换器", "_switch", "switch"),
    (r"optical|^ont\b|^onu\b|光猫", None, "modem"),
    (r"pc\b|desktop|laptop|notebook|电脑", "windows", "pc"),
]


def fetch(url, dest):
    if os.path.exists(dest):
        return dest
    req = urllib.request.Request(url, headers={"User-Agent": "carbon-theme-build"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        f.write(r.read())
    return dest


def main():
    os.makedirs(CACHE, exist_ok=True)

    # --- icons -----------------------------------------------------------
    paths, boxes = {}, {}
    for key, entry in BRANDS.items():
        style = entry[1]
        if style[0] != "icon":
            continue
        slug = style[1]
        if slug in CUSTOM_ICONS:
            boxes[key], paths[key] = CUSTOM_ICONS[slug]
            continue
        svg = open(fetch(f"{SI_BASE}/icons/{slug}.svg", os.path.join(CACHE, slug + ".svg")), encoding="utf-8").read()
        m = re.search(r'<path d="([^"]+)"', svg)
        if not m:
            sys.exit(f"no path in {slug}.svg")
        paths[key] = m.group(1)

    # --- OUI -------------------------------------------------------------
    oui_csv = fetch(OUI_URL, os.path.join(CACHE, "oui.csv"))
    rules = [(k, re.compile(v[2])) for k, v in BRANDS.items() if v[2]]
    prefixes = {k: set() for k, _ in rules}
    with open(oui_csv, encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f):
            if row.get("Registry") != "MA-L":
                continue
            org = row.get("Organization Name", "")
            for k, rx in rules:
                if rx.search(org):
                    prefixes[k].add(row["Assignment"].strip().upper())
                    break

    oui = {}
    for k, s in prefixes.items():
        if not s:
            continue
        raw = b"".join(bytes.fromhex(p) for p in sorted(s))
        oui[k] = base64.b64encode(raw).decode("ascii")

    # --- emit ------------------------------------------------------------
    brands = {}
    for key, entry in BRANDS.items():
        name, style = entry[0], entry[1]
        b = {"n": name}
        kind = style[0]
        bg = style[2] if len(style) > 2 else None
        if bg == "INV":
            b["inv"] = 1
        elif bg:
            b["bg"] = bg
        if kind == "icon":
            b["p"] = paths[key]
            if key in boxes:
                b["vb"] = boxes[key]
        elif kind == "mono":
            b["m"] = style[1]
            if len(style) > 3:
                b["fg"] = style[3]
        else:
            b["g"] = style[1]
        if key in WORDMARKS:
            b["wm"] = 1
        if len(BRANDS[key]) > 3 and BRANDS[key][3]:
            b["t"] = BRANDS[key][3]
        brands[key] = b

    host = [[rx, k, t] for rx, k, t in HOST_RULES]

    js = (
        "/*!\n"
        " * Carbon — brand data for the connected-devices list (generated by scripts/gen-brands.py).\n"
        f" * Brand glyphs: Simple Icons {SI_VERSION} (CC0 1.0). All trademarks belong to their owners.\n"
        " * MAC prefixes: IEEE Registration Authority MA-L registry.\n"
        " */\n"
        "(function (C) {\n"
        "\t'use strict';\n"
        f"\tC.BRAND_DATA = {json.dumps({'brands': brands, 'host': host, 'oui': oui}, separators=(',', ':'), ensure_ascii=False)};\n"
        "\tif (typeof C.onBrands === 'function') C.onBrands();\n"
        "})(window.Carbon = window.Carbon || {});\n"
    )
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)

    total = sum(len(s) for s in prefixes.values())
    print(f"wrote {OUT}: {len(js) // 1024} KB, {len(brands)} brands, {len(paths)} icons, {total} OUI prefixes")


if __name__ == "__main__":
    main()
