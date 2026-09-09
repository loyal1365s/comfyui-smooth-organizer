# 🌟 ComfyUI Smooth Organizer

Version **1.0.1**

Smooth Organizer is a graph-aware layout extension for ComfyUI. It uses the official frontend extension hook for Canvas menus and keeps its layout vocabulary and interaction model independent from other organizer extensions.

## ✨ Layout modes



* **Smart Arrange:** Chooses a calm graph-oriented arrangement with depth, sibling alignment and collision cleanup.


* **Flow Stack:** Deterministic left-to-right dependency layout with crossing reduction and median alignment.


* **Branch Focus:** Expands the connected neighborhood of the current selection and organizes that branch as a coherent unit.


* **Blueprint Grid:** Regular grid for cleanup and overview work.


* **Dense Pack:** Compact packing when the priority is reducing empty canvas space.


* **Type Lanes:** Groups nodes by node family/type into clean vertical lanes.



## 🧹 Workflow cleanup



* **Tidy Groups:** Organizes nodes inside existing groups without intentionally breaking their membership.


* **Clean Reroutes:** Lightly normalizes reroute positions without aggressively moving user-placed routing points.


* **Arrange Selection:** Applies the selected layout to only the selected nodes.



## 🧠 Workflow-aware rules



* `Load Image` nodes are anchored to the left side of a full layout.


* `Save Image` nodes are anchored to the right side.


* Variable node sizes are respected.


* A final global collision pass prevents nodes from overlapping across adjacent layers.


* Arrange transitions animate smoothly over 500 ms with an ease-out motion.


* Branches and fan-out/fan-in structures receive crossing-reduction passes.


* Cycles are handled deterministically instead of causing infinite traversal.


* Layout changes are captured through ComfyUI's native change tracker when available, so normal Undo/Redo can be used.


* Canvas invalidation/redraw happens immediately after an operation and once more on the next animation frame.


* No LiteGraph prototype monkey-patching is used.



## 🚀 Installation



**Method 1: ComfyUI Manager (Recommended)**

1. Open ComfyUI Manager.
2. Click on "Install Custom Nodes".
3. Search for `Smooth Organizer` or `loyal1365s`.
4. Click Install and restart ComfyUI.

**Method 2: Manual Install**

1. Copy `comfyui-smooth-organizer` into: `ComfyUI/custom_nodes/`. Alternatively, use git clone:
git clone [https://github.com/loyal1365s/comfyui-smooth-organizer](https://github.com/loyal1365s/comfyui-smooth-organizer)


2. Restart ComfyUI and refresh the browser.



---

# 🇮🇷 راهنمای فارسی (ComfyUI Smooth Organizer)

نسخه **1.0.1**

پلاگین Smooth Organizer یک افزونه چیدمان هوشمند و مبتنی بر گراف برای کامفی‌یوآی است. این افزونه از هوک‌های رسمی فرانت‌اند برای منوهای Canvas استفاده می‌کند و کلمات کلیدی چیدمان و مدل تعاملی آن کاملاً مستقل از سایر افزونه‌های مرتب‌سازی عمل می‌کند.

## ✨ حالت‌های چیدمان (Layout modes)



* **Smart Arrange:** یک چیدمان آرام و مبتنی بر گراف با در نظر گرفتن عمق، تراز کردن نودهای هم‌سطح و پاکسازی تداخل‌ها.


* **Flow Stack:** چیدمان قطعی چپ‌به‌راست بر اساس وابستگی‌ها، با کاهش تقاطع خطوط و تراز میانی.


* **Branch Focus:** همسایه‌های متصل به نودهای انتخاب شده را گسترش داده و آن شاخه را به عنوان یک واحد منسجم مرتب می‌کند.


* **Blueprint Grid:** یک شبکه (گرید) منظم برای تمیز کردن و بررسی کلی ورک‌فلو.


* **Dense Pack:** بسته‌بندی فشرده نودها برای زمانی که اولویت شما کاهش فضای خالی روی صفحه است.


* **Type Lanes:** نودها را بر اساس خانواده/نوع آن‌ها در لاین‌های عمودی و تمیز دسته‌بندی می‌کند.



## 🧹 پاکسازی ورک‌فلو (Workflow cleanup)



* **Tidy Groups:** نودهای داخل گروه‌های موجود را بدون از بین بردن عمدی عضویت آن‌ها مرتب می‌کند.


* **Clean Reroutes:** موقعیت نودهای Reroute را به صورت ملایم بهینه‌سازی می‌کند، بدون اینکه نقاطی که کاربر دستی قرار داده را به شدت جابجا کند.


* **Arrange Selection:** چیدمان انتخابی را فقط روی نودهای انتخاب شده اعمال می‌کند.



## 🧠 قوانین هوشمند ورک‌فلو (Workflow-aware rules)



* نودهای `Load Image` به سمت چپ چیدمان کامل لنگر می‌اندازند (تثبیت می‌شوند).


* نودهای `Save Image` به سمت راست چیدمان لنگر می‌اندازند.


* ابعاد متغیر نودها در نظر گرفته می‌شود.


* یک بررسی نهایی سراسری از روی هم افتادن نودها در لایه‌های مجاور جلوگیری می‌کند.


* تغییرات چیدمان دارای یک انیمیشن نرم ۵۰۰ میلی‌ثانیه‌ای (ease-out) هستند.


* ساختارهای شاخه‌ای و ورودی/خروجی‌های چندگانه برای کاهش تقاطع خطوط پردازش می‌شوند.


* حلقه‌ها (Cycles) به جای ایجاد پردازش بی‌نهایت، به صورت قطعی مدیریت می‌شوند.


* تغییرات چیدمان توسط سیستم ردیابی بومی ComfyUI ثبت می‌شوند (در صورت در دسترس بودن)، بنابراین می‌توانید از قابلیت Undo/Redo به صورت عادی استفاده کنید.


* به‌روزرسانی و رندر مجدد صفحه (Redraw) بلافاصله پس از انجام عملیات و یک بار دیگر در فریم انیمیشن بعدی اتفاق می‌افتد.


* در این افزونه از روش‌های غیراستاندارد (مانند LiteGraph monkey-patching) استفاده نشده است.



## 🚀 راهنمای نصب



**روش اول: از طریق ComfyUI Manager (پیشنهادی)**
۱. بخش ComfyUI Manager را باز کنید.
۲. روی "Install Custom Nodes" کلیک کنید.
۳. عبارت `Smooth Organizer` یا `loyal1365s` را جستجو کنید.
۴. روی Install کلیک کرده و کامفی‌یوآی را ری‌استارت کنید.

**روش دوم: نصب دستی**
۱. پوشه `comfyui-smooth-organizer` را در مسیر `ComfyUI/custom_nodes/` کپی کنید. یا دستور زیر را در ترمینال وارد کنید:
git clone [https://github.com/loyal1365s/comfyui-smooth-organizer](https://github.com/loyal1365s/comfyui-smooth-organizer)
۲. کامفی‌یوآی را ری‌استارت کرده و مرورگر را رفرش کنید.