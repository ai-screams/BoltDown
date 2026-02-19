use crate::error::AppError;

#[cfg(target_os = "macos")]
mod macos {
    use std::ffi::c_void;

    // Carbon Input Source Services FFI
    #[link(name = "Carbon", kind = "framework")]
    extern "C" {
        fn TISCopyCurrentKeyboardInputSource() -> *mut c_void;
        fn TISCreateASCIICapableInputSourceList() -> *mut c_void;
        fn TISCreateInputSourceList(properties: *const c_void, all: bool) -> *mut c_void;
        fn TISSelectInputSource(source: *mut c_void) -> i32;
        fn TISGetInputSourceProperty(source: *const c_void, key: *const c_void) -> *const c_void;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFArrayGetCount(arr: *const c_void) -> isize;
        fn CFArrayGetValueAtIndex(arr: *const c_void, idx: isize) -> *const c_void;
        fn CFRelease(cf: *const c_void);

        // CFString helpers
        fn CFStringGetLength(s: *const c_void) -> isize;
        fn CFStringGetCString(
            s: *const c_void,
            buf: *mut u8,
            buf_size: isize,
            encoding: u32,
        ) -> bool;
        fn CFStringCreateWithBytes(
            alloc: *const c_void,
            bytes: *const u8,
            num_bytes: isize,
            encoding: u32,
            is_external: bool,
        ) -> *mut c_void;

        // CFDictionary helpers
        fn CFDictionaryCreate(
            alloc: *const c_void,
            keys: *const *const c_void,
            values: *const *const c_void,
            count: isize,
            key_cbs: *const c_void,
            val_cbs: *const c_void,
        ) -> *mut c_void;

        static kCFTypeDictionaryKeyCallBacks: c_void;
        static kCFTypeDictionaryValueCallBacks: c_void;
    }

    // kTISPropertyInputSourceID — CFString key for source identifier
    extern "C" {
        #[link_name = "kTISPropertyInputSourceID"]
        static K_TIS_PROPERTY_INPUT_SOURCE_ID: *const c_void;
    }

    const K_CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;

    /// Convert a CFStringRef to a Rust String.
    unsafe fn cfstring_to_string(cf: *const c_void) -> Option<String> {
        if cf.is_null() {
            return None;
        }
        let len = unsafe { CFStringGetLength(cf) };
        let buf_size = (len * 4 + 1) as usize; // UTF-8 worst case
        let mut buf = vec![0u8; buf_size];
        let ok = unsafe {
            CFStringGetCString(
                cf,
                buf.as_mut_ptr(),
                buf_size as isize,
                K_CF_STRING_ENCODING_UTF8,
            )
        };
        if !ok {
            return None;
        }
        let end = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
        String::from_utf8(buf[..end].to_vec()).ok()
    }

    /// Create a CFStringRef from a Rust &str.
    unsafe fn string_to_cfstring(s: &str) -> *mut c_void {
        unsafe {
            CFStringCreateWithBytes(
                std::ptr::null(),
                s.as_ptr(),
                s.len() as isize,
                K_CF_STRING_ENCODING_UTF8,
                false,
            )
        }
    }

    /// Get the current input source identifier (e.g. "com.apple.keylayout.ABC").
    pub fn get_current_source_id() -> Option<String> {
        unsafe {
            let source = TISCopyCurrentKeyboardInputSource();
            if source.is_null() {
                return None;
            }
            let prop = TISGetInputSourceProperty(source, K_TIS_PROPERTY_INPUT_SOURCE_ID);
            let result = cfstring_to_string(prop);
            CFRelease(source);
            result
        }
    }

    /// Switch to the first ASCII-capable input source. Returns its identifier.
    pub fn select_ascii_source() -> Option<String> {
        unsafe {
            let list = TISCreateASCIICapableInputSourceList();
            if list.is_null() {
                return None;
            }
            let count = CFArrayGetCount(list);
            if count == 0 {
                CFRelease(list);
                return None;
            }
            let source = CFArrayGetValueAtIndex(list, 0);
            TISSelectInputSource(source as *mut c_void);
            let prop = TISGetInputSourceProperty(source, K_TIS_PROPERTY_INPUT_SOURCE_ID);
            let result = cfstring_to_string(prop);
            CFRelease(list);
            result
        }
    }

    /// Get current source ID + switch to ASCII. Returns the previous source ID.
    /// Effectively atomic: called within synchronous vim-mode-change event handler.
    pub fn save_and_switch_to_ascii() -> Option<String> {
        let prev = get_current_source_id();
        select_ascii_source();
        prev
    }

    /// Select a specific input source by its identifier.
    pub fn select_source_by_id(source_id: &str) -> bool {
        unsafe {
            let cf_id = string_to_cfstring(source_id);
            if cf_id.is_null() {
                return false;
            }

            // Build filter: { kTISPropertyInputSourceID: source_id }
            let keys = [K_TIS_PROPERTY_INPUT_SOURCE_ID];
            let values = [cf_id as *const c_void];
            let dict = CFDictionaryCreate(
                std::ptr::null(),
                keys.as_ptr(),
                values.as_ptr(),
                1,
                &kCFTypeDictionaryKeyCallBacks as *const _,
                &kCFTypeDictionaryValueCallBacks as *const _,
            );
            CFRelease(cf_id);

            if dict.is_null() {
                return false;
            }

            let list = TISCreateInputSourceList(dict, false);
            CFRelease(dict);

            if list.is_null() {
                return false;
            }

            let count = CFArrayGetCount(list);
            if count == 0 {
                CFRelease(list);
                return false;
            }

            let source = CFArrayGetValueAtIndex(list, 0);
            let result = TISSelectInputSource(source as *mut c_void);
            CFRelease(list);
            result == 0
        }
    }
}

/// Get the current keyboard input source ID.
#[tauri::command]
pub fn get_input_source() -> Result<String, AppError> {
    #[cfg(target_os = "macos")]
    {
        macos::get_current_source_id()
            .ok_or_else(|| AppError::Ime("Failed to get input source".into()))
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok("unsupported".into())
    }
}

/// Switch to the ASCII-capable input source (e.g. ABC / US keyboard).
#[tauri::command]
pub fn select_ascii_input() -> Result<String, AppError> {
    #[cfg(target_os = "macos")]
    {
        macos::select_ascii_source()
            .ok_or_else(|| AppError::Ime("Failed to select ASCII input source".into()))
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok("unsupported".into())
    }
}

/// Save current input source and switch to ASCII. Returns previous source ID.
/// Effectively atomic in practice: called from synchronous `vim-mode-change`
/// event handler, so no interleaving IME switches can occur.
#[tauri::command]
pub fn ime_save_and_switch_ascii() -> Result<String, AppError> {
    #[cfg(target_os = "macos")]
    {
        macos::save_and_switch_to_ascii()
            .ok_or_else(|| AppError::Ime("Failed to switch input source".into()))
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok("unsupported".into())
    }
}

/// Select a specific input source by its identifier (e.g. "com.apple.inputmethod.Korean.2SetKorean").
#[tauri::command]
pub fn select_input_source(source_id: String) -> Result<bool, AppError> {
    #[cfg(target_os = "macos")]
    {
        Ok(macos::select_source_by_id(&source_id))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = source_id;
        Ok(false)
    }
}
