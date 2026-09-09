import type { Task } from '@/types/task'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import TaskDialog from './index.vue'

const fetchMock = vi.fn<typeof fetch>()

/** Builds a `fetch` Response double with the given status and JSON body. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * jsdom 30 ships `<dialog>` with the reflected `open` and nothing else. These stand-ins
 * do the two things the component depends on: `open` flipping, and `close` firing.
 */
beforeEach(() => {
  // The sheet files its own save, so a submit needs somewhere to file into and a
  // server to answer. A fresh pinia per test, or one test's task outlives it.
  setActivePinia(createPinia())
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(jsonResponse(201, task()))

  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
    this.open = true
  }

  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})

enableAutoUnmount(afterEach)

/** Builds a task fixture; only the fields this component reads are varied. */
function task(overrides: Partial<Task> = {}): Task {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    category: 1,
    sequence: 12,
    title: '補上 CORS 設定',
    description: '前端在 5173，後端在 8080。',
    completed: false,
    dueDate: '2026-09-30',
    createdAt: '2026-09-06T10:00:00Z',
    updatedAt: '2026-09-06T10:00:00Z',
    ...overrides,
  }
}

/** Mounts a sheet, left down: opening it is a call, so it is never up on arrival. */
function mountSheet() {
  return mount(TaskDialog, { attachTo: document.body })
}

/**
 * Mounts a sheet and opens it blank. Awaited: the values are written to the fields
 * as the sheet opens, so the DOM is one tick behind the call.
 */
async function mountCreate() {
  const wrapper = mountSheet()

  wrapper.vm.open('create')
  await nextTick()

  return wrapper
}

/** Mounts a sheet and opens it on `source`. */
async function mountEdit(source: Task = task()) {
  const wrapper = mountSheet()

  wrapper.vm.open('edit', source)
  await nextTick()

  return wrapper
}

/** The URL the most recent request went to. */
function lastUrl(): string {
  return String(fetchMock.mock.calls.at(-1)?.[0])
}

/** The options the most recent request was sent with. */
function lastInit(): RequestInit {
  return fetchMock.mock.calls.at(-1)?.[1] ?? {}
}

/** The JSON body the most recent request carried. */
function lastBody(): unknown {
  return JSON.parse(String(lastInit().body))
}

/** Presses 確定 and waits for whatever that put on the wire to come back. */
async function save(wrapper: ReturnType<typeof mountSheet>): Promise<void> {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

/** The value currently in one of the four fields. */
function valueOf(wrapper: ReturnType<typeof mountSheet>, field: string): string {
  return wrapper.get<HTMLInputElement>(`[data-field="${field}"] input, [data-field="${field}"] select, [data-field="${field}"] textarea`).element.value
}

describe('TaskDialog', () => {
  describe('新增模式', () => {
    it('names itself as the blank sheet it is', async () => {
      const wrapper = await mountCreate()

      expect(wrapper.get('h2').text()).toBe('新增工單')
    })

    it('says NEW where the number goes, rather than leaving the slot empty', async () => {
      // A blank slot beside the heading reads as a number that failed to load;
      // a new task genuinely has no number until the server issues one.
      const wrapper = await mountCreate()

      expect(wrapper.get('[data-number]').text()).toBe('NEW')
    })

    it('opens on empty fields with the first category selected', async () => {
      const wrapper = await mountCreate()

      expect(valueOf(wrapper, 'title')).toBe('')
      expect(valueOf(wrapper, 'description')).toBe('')
      expect(valueOf(wrapper, 'due-date')).toBe('')
      expect(valueOf(wrapper, 'category')).toBe('1')
    })

    it('leaves nothing of the task it was last opened on', async () => {
      // One sheet serves both jobs, so a blank one opened after an edit is the same
      // element — emptied, or the new task starts life carrying the last one's title.
      const wrapper = await mountEdit()

      wrapper.vm.open('create')
      await nextTick()

      expect(wrapper.get('h2').text()).toBe('新增工單')
      expect(wrapper.get('[data-number]').text()).toBe('NEW')
      expect(valueOf(wrapper, 'title')).toBe('')
      expect(valueOf(wrapper, 'description')).toBe('')
      expect(valueOf(wrapper, 'due-date')).toBe('')
    })
  })

  describe('編輯模式', () => {
    it('names itself as the correction it is', async () => {
      const wrapper = await mountEdit()

      expect(wrapper.get('h2').text()).toBe('編輯工單')
    })

    it("carries the task's number in the corner, so the sheet says which one it is", async () => {
      const wrapper = await mountEdit()

      expect(wrapper.get('[data-number]').text()).toBe('bug-0012')
    })

    it('brings every stored value back into its own field', async () => {
      const wrapper = await mountEdit()

      expect(valueOf(wrapper, 'title')).toBe('補上 CORS 設定')
      expect(valueOf(wrapper, 'category')).toBe('1')
      expect(valueOf(wrapper, 'description')).toBe('前端在 5173，後端在 8080。')
      expect(valueOf(wrapper, 'due-date')).toBe('2026-09-30')
    })

    it('leaves the optional fields blank when the task has neither', async () => {
      // The contract sends `null` for "not set"; assigned straight to an input that
      // renders the four characters `null`, to be deleted before typing.
      const wrapper = await mountEdit(task({ description: null, dueDate: null }))

      expect(valueOf(wrapper, 'description')).toBe('')
      expect(valueOf(wrapper, 'due-date')).toBe('')
    })

    it('reseeds when reopened on a different task', async () => {
      // The values are read once, as the sheet opens; without re-reading, the
      // previous task's title would sit under the new task's number.
      const wrapper = await mountEdit()

      wrapper.vm.close()
      wrapper.vm.open('edit', task({ title: '換掉錯字', sequence: 7 }))
      await nextTick()

      expect(valueOf(wrapper, 'title')).toBe('換掉錯字')
      expect(wrapper.get('[data-number]').text()).toBe('bug-0007')
    })

    it('starts the caret in 標題 with the old title selected', async () => {
      // The sheet opens ready to have its title typed over. Selecting is why focus
      // waits a tick: run earlier it would take whatever the box held before.
      const wrapper = await mountEdit()
      const input = wrapper.get<HTMLInputElement>('[data-field="title"] input').element

      expect(document.activeElement).toBe(input)
      expect(input.selectionStart).toBe(0)
      expect(input.selectionEnd).toBe(task().title.length)
    })
  })

  describe('提示列', () => {
    it('keeps every row empty but standing, apart from the one with a message', async () => {
      // The rows hold their height so a message cannot push the form down. Changing
      // category writes nothing: the re-issued number is the server's to assign.
      const wrapper = await mountEdit()

      await wrapper.get('select').setValue(0)

      expect(wrapper.findAll('span[aria-live]').map((row) => row.text())).toEqual(['', '', '', ''])
    })
  })

  describe('送出', () => {
    it('sends exactly what the four fields hold', async () => {
      const wrapper = await mountCreate()

      await wrapper.get('[data-field="title"] input').setValue('  補上 CORS 設定  ')
      await wrapper.get('select').setValue(0)
      await wrapper.get('textarea').setValue('  前端在 5173  ')
      await wrapper.get('[data-field="due-date"] input').setValue('2026-09-30')
      await save(wrapper)

      expect(lastBody()).toEqual({
        title: '補上 CORS 設定',
        description: '前端在 5173',
        category: 0,
        dueDate: '2026-09-30',
      })
    })

    it('sends the empty optional fields as null rather than as empty strings', async () => {
      // Both requests replace the whole task, so `''` would file a task whose
      // deadline is the empty string instead of one with no deadline.
      const wrapper = await mountCreate()

      await wrapper.get('[data-field="title"] input').setValue('沒有說明也沒有期限')
      await save(wrapper)

      expect(lastBody()).toMatchObject({ description: null, dueDate: null })
    })

    it('refuses a blank title and says so in the row kept for it', async () => {
      const wrapper = await mountCreate()

      await wrapper.get('[data-field="title"] input').setValue('   ')
      await save(wrapper)

      // Nothing reaches the wire for the server to refuse: the one required
      // field is checked here, where the message has a row to land in.
      expect(fetchMock).not.toHaveBeenCalled()
      expect(wrapper.get('[data-field="title"] span[aria-live]').text()).toBe('標題不能空白。')
    })

    it('reddens the line as well as the message, focus included', async () => {
      // The whole field has to say which one is wrong. Failing validation puts the
      // caret here, so a standing focus colour would take the red away just then.
      const wrapper = await mountCreate()

      await wrapper.get('form').trigger('submit')

      const classes = wrapper.get('[data-field="title"] input').classes()

      expect(classes).toContain('border-b-alert')
      expect(classes).toContain('focus:border-b-alert')
      expect(classes).toContain('focus:shadow-[0_1.5px_0_var(--color-alert)]')
      expect(classes).not.toContain('focus:border-b-stamp')
      expect(classes).not.toContain('focus:shadow-[0_1.5px_0_var(--color-stamp)]')
    })

    it('takes the message away as soon as the person starts fixing it', async () => {
      const wrapper = await mountCreate()

      await wrapper.get('form').trigger('submit')
      await wrapper.get('[data-field="title"] input').setValue('補')

      expect(wrapper.get('[data-field="title"] span[aria-live]').text()).toBe('')
    })

    it('stays up until the save has landed, and goes down once it has', async () => {
      // Closing on submit would throw the typing away every time a save came
      // back refused, which is exactly what this form can produce.
      const wrapper = await mountCreate()

      let settle: (response: Response) => void = () => {}
      fetchMock.mockReturnValue(
        new Promise<Response>((resolve) => {
          settle = resolve
        }),
      )

      await wrapper.get('[data-field="title"] input').setValue('補上 CORS 設定')
      await wrapper.get('form').trigger('submit')

      expect(wrapper.get('dialog').attributes('open')).toBeDefined()
      expect(wrapper.emitted('close')).toBeUndefined()

      settle(jsonResponse(201, task()))
      await flushPromises()

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })

  describe('存檔', () => {
    it("files a blank sheet through the contract's create endpoint", async () => {
      const wrapper = await mountCreate()

      await wrapper.get('[data-field="title"] input').setValue('補上 CORS 設定')
      await save(wrapper)

      expect(lastUrl()).toBe('/api/tasks')
      expect(lastInit().method).toBe('POST')
    })

    it('saves an open docket against its own id', async () => {
      // Which of the two requests a save becomes is the sheet's own question to
      // answer: it is the only thing that knows which docket it is on.
      const wrapper = await mountEdit()

      await save(wrapper)

      expect(lastUrl()).toBe('/api/tasks/3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31')
      expect(lastInit().method).toBe('PUT')
    })

    it('files a blank sheet opened after an edit as a new docket', async () => {
      // One sheet does both jobs, so which request a save becomes cannot be
      // left to whichever docket the sheet happened to be on last.
      const wrapper = await mountEdit()

      wrapper.vm.open('create')
      await nextTick()

      await wrapper.get('[data-field="title"] input').setValue('補上 CORS 設定')
      await save(wrapper)

      expect(lastUrl()).toBe('/api/tasks')
      expect(lastInit().method).toBe('POST')
    })

    it('sends one request when 確定 is pressed twice', async () => {
      // A second POST files the same docket twice, and the copy can only be
      // taken back by deleting it — so the press is dropped rather than queued.
      const wrapper = await mountCreate()

      let settle: (response: Response) => void = () => {}
      fetchMock.mockReturnValue(
        new Promise<Response>((resolve) => {
          settle = resolve
        }),
      )

      await wrapper.get('[data-field="title"] input').setValue('補上 CORS 設定')
      await wrapper.get('form').trigger('submit')
      await wrapper.get('form').trigger('submit')

      expect(fetchMock).toHaveBeenCalledTimes(1)

      settle(jsonResponse(201, task()))
      await flushPromises()
    })
  })

  describe('存檔失敗', () => {
    it('says nothing at all while nothing has failed', async () => {
      const wrapper = await mountCreate()

      expect(wrapper.find('[data-submit-error]').exists()).toBe(false)
    })

    it("prints the server's own reason under the fields it is about", async () => {
      // 這張單子沒存進去 on its own gives nothing to act on: the problem detail
      // is what says which of the four fields the server would not take.
      const wrapper = await mountCreate()
      fetchMock.mockResolvedValue(
        jsonResponse(400, { status: 400, title: 'Bad Request', detail: '標題不能超過 200 個字。' }),
      )

      await wrapper.get('[data-field="title"] input').setValue('補上 CORS 設定')
      await save(wrapper)

      const notice = wrapper.get('[data-submit-error]')

      expect(notice.text()).toContain('這張單子沒存進去')
      expect(notice.text()).toContain('標題不能超過 200 個字。')
      // Nothing was asked of the reader — 確定 was pressed and the answer came
      // back a refusal — so it is announced rather than left to be noticed.
      expect(notice.attributes('role')).toBe('alert')
    })

    it('says so even when the request never reached a server', async () => {
      // `fetch` rejects outright when the backend is down, carrying no status. A 確定
      // that appeared to do nothing cannot be told apart from a broken button.
      const wrapper = await mountCreate()
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

      await wrapper.get('[data-field="title"] input').setValue('補上 CORS 設定')
      await save(wrapper)

      expect(wrapper.get('[data-submit-error]').text()).toContain('Failed to fetch')
    })

    it('stays up with the typing still in it', async () => {
      // The whole reason the sheet does not close on submit: a refused save
      // that took the form with it would take the writing too.
      const wrapper = await mountCreate()
      fetchMock.mockResolvedValue(jsonResponse(500, { status: 500, title: 'Server error' }))

      await wrapper.get('[data-field="title"] input').setValue('補上 CORS 設定')
      await save(wrapper)

      expect(wrapper.get('dialog').attributes('open')).toBeDefined()
      expect(valueOf(wrapper, 'title')).toBe('補上 CORS 設定')
    })

    it('lets 確定 be pressed again once a refusal has come back', async () => {
      // The guard against a double press must not outlive the request it was
      // guarding, or one refusal would leave the sheet unable to save at all.
      const wrapper = await mountCreate()
      fetchMock.mockResolvedValue(jsonResponse(500, { status: 500, title: 'Server error' }))

      await wrapper.get('[data-field="title"] input').setValue('補上 CORS 設定')
      await save(wrapper)

      fetchMock.mockResolvedValue(jsonResponse(201, task()))
      await save(wrapper)

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
    })

    it('takes the notice away as soon as another attempt starts', async () => {
      // It describes the previous attempt; leaving it up beside a request that
      // is on the wire would say the new one had failed too.
      const wrapper = await mountCreate()
      fetchMock.mockResolvedValue(jsonResponse(500, { status: 500, title: 'Server error' }))

      await wrapper.get('[data-field="title"] input').setValue('補上 CORS 設定')
      await save(wrapper)
      expect(wrapper.find('[data-submit-error]').exists()).toBe(true)

      // The second attempt is left in flight on purpose: one that landed would
      // close the sheet, and a notice cannot be read off a sheet that is down.
      fetchMock.mockReturnValue(new Promise<Response>(() => {}))
      await wrapper.get('form').trigger('submit')

      expect(wrapper.find('[data-submit-error]').exists()).toBe(false)
    })

    it('does not carry a refusal onto the next docket', async () => {
      // One sheet serves every task, so a notice left standing would blame the
      // next docket for what happened to the last one.
      const wrapper = await mountCreate()
      fetchMock.mockResolvedValue(jsonResponse(500, { status: 500, title: 'Server error' }))

      await wrapper.get('[data-field="title"] input').setValue('補上 CORS 設定')
      await save(wrapper)

      wrapper.vm.open('edit', task())
      await nextTick()

      expect(wrapper.find('[data-submit-error]').exists()).toBe(false)
    })
  })

  describe('開關', () => {
    it('stays down until it is asked for', () => {
      // Nothing but `open()` puts the sheet up, so a page can mount it once and leave
      // it there — which is what lets the browser hand focus back.
      const wrapper = mountSheet()

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
    })

    it('opens as a modal, not as an inline block', async () => {
      // showModal is what brings the focus trap, the Esc key and the backdrop;
      // show() would render the same markup with none of them.
      const wrapper = mountSheet()
      const showModal = vi.spyOn(wrapper.get<HTMLDialogElement>('dialog').element, 'showModal')

      wrapper.vm.open('create')
      await nextTick()

      expect(showModal).toHaveBeenCalledOnce()
    })

    it('moves an open sheet onto another task without opening it twice', async () => {
      // showModal() on an already-open dialog throws, and the owner is entitled to
      // call open() again — a second card's row menu while the first is on the desk.
      const wrapper = await mountEdit()
      const showModal = vi.spyOn(wrapper.get<HTMLDialogElement>('dialog').element, 'showModal')

      wrapper.vm.open('edit', task({ title: '換掉錯字', sequence: 7 }))
      await nextTick()

      expect(showModal).not.toHaveBeenCalled()
      expect(valueOf(wrapper, 'title')).toBe('換掉錯字')
    })

    it('takes itself away when asked, and says that it went', async () => {
      const wrapper = await mountCreate()

      wrapper.vm.close()
      await nextTick()

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('closes on 取消 rather than asking to be closed', async () => {
      const wrapper = await mountCreate()

      await wrapper.get('button[type="button"]').trigger('click')

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('reports the dismissals the browser carries out, such as Esc', async () => {
      const wrapper = await mountCreate()

      wrapper.get<HTMLDialogElement>('dialog').element.close()
      await nextTick()

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('ignores a close on a sheet that is already down', async () => {
      // The owner closes the sheet after a save without first checking what the
      // person did while it was in flight, so a second close has to be nothing.
      const wrapper = await mountCreate()

      wrapper.vm.close()
      wrapper.vm.close()
      await nextTick()

      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })

  describe('無障礙', () => {
    it('points every label at its own field', async () => {
      const wrapper = await mountEdit()
      const labels = wrapper.findAll('label')
      const ids = wrapper
        .findAll('input, select, textarea')
        .map((field) => field.attributes('id'))

      expect(labels).toHaveLength(4)
      expect(labels.map((label) => label.attributes('for'))).toEqual(ids)
    })

    it('names the sheet by its own heading', async () => {
      const wrapper = await mountEdit()

      expect(wrapper.get('dialog').attributes('aria-labelledby')).toBe(
        wrapper.get('h2').attributes('id'),
      )
    })

    it('gives two sheets on one page two sets of ids', () => {
      // Hard-coded ids would leave one label pointing at the other sheet's field. Both
      // mounted in one app: `useId` counts per app, so separate mounts would collide.
      const wrapper = mount(
        defineComponent({
          render: () => [h(TaskDialog), h(TaskDialog)],
        }),
      )

      const ids = wrapper.findAll('[data-field="title"] input').map((field) => field.attributes('id'))

      expect(ids).toHaveLength(2)
      expect(ids[0]).not.toBe(ids[1])
    })

    it('keeps the required star out of the accessibility tree', async () => {
      // `required` on the input is what carries the meaning; the star is a mark
      // for people who can see the form, and announcing it says "asterisk".
      const wrapper = await mountCreate()

      expect(wrapper.get('[data-field="title"] input').attributes('required')).toBeDefined()
      expect(wrapper.get('[data-field="title"] label span').attributes('aria-hidden')).toBe('true')
    })

    it('binds each message row back to the field it talks about', async () => {
      const wrapper = await mountCreate()
      const input = wrapper.get('[data-field="title"] input')
      const message = wrapper.get('[data-field="title"] span[aria-live]')

      expect(input.attributes('aria-describedby')).toBe(message.attributes('id'))
      expect(message.attributes('aria-live')).toBe('polite')
    })
  })
})
