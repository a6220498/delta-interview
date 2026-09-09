// [AI assisted 011] 這個數字放 `src/const/`，不放各元件自己的 `const/`：三顆按鈕共用的是
// 同一條政策，散成三份遲早各自漂移。DeleteDialog 原本連 `const/` 資料夾都沒有，為了一個
// 數字生一整層目錄也不划算。
export const WRITE_THROTTLE_MS = 500
