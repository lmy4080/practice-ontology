const NativeDate = globalThis.Date;
const anchor = NativeDate.parse(process.env.COURSE_NOW ?? "");
const offset = Number.isFinite(anchor) ? anchor - NativeDate.now() : 0;

class CourseDate extends NativeDate {
  constructor(value?: string | number | NativeDate) {
    super(arguments.length === 0 ? NativeDate.now() + offset : value as string | number);
  }

  static now() {
    return NativeDate.now() + offset;
  }
}

globalThis.Date = CourseDate as unknown as DateConstructor;
