---
title: Multi-Level Interrupts in Zephyr
image: https://photo.weenas.com/bmUTlD.jpg
date: 2019-01-17
tags:
  - zephyr
description: A clever way to implement multi-level interrupts, and a useful reference for interrupt design.
keywords:
  - zephyr
  - interrupt
pubDatetime: 2019-01-17
---

Understanding the interrupt subsystem helps us better understand how an operating system works, and every OS implements it differently. Linux generally registers interrupts dynamically, so interrupt handlers can be registered with the OS while the system is running. Zephyr, to keep the image small, registers them statically: at build time, every `IRQ_CONNECT` is resolved into an ISR table.

<!--more-->

## Single-Level Interrupts

If the system only needs one level of interrupts, the generated ISR table (interrupt vector table) looks fairly simple. After building, it's generated at `zephyr/isr_tables.c`:

```c
struct _isr_table_entry {
    void *arg;
    void (*isr)(void *);
};

struct _isr_table_entry __sw_isr_table _sw_isr_table[160] = {
    {(void *)0x1979e0, (void *)0x114fc1},
    {(void *)0x1979ec, (void *)0x114fc1},
    {(void *)0x2, (void *)0x109e01},
    {(void *)0x3, (void *)0x109e01},
    {(void *)0x4, (void *)0x109e01},
    {(void *)0x5, (void *)0x109e01}
};
```

As you can see, on a 32-bit system each ISR table entry takes 8 bytes: the first 4 bytes are the argument and the last 4 bytes are the handler. The size of the ISR table is set by `CONFIG_NUM_IRQS` and can be adjusted as needed.

When Zephyr boots, it sets the ISR table address in the CPU's VTOR register (taking the Cortex-M4 as an example). When an interrupt fires, the CPU enters the corresponding interrupt service routine based on the interrupt number.

## Multi-Level Interrupts

A CPU's interrupt controller can usually only handle a limited number of interrupts. ARM Cortex-M interrupt controllers typically support 64 external IRQs and 64 FIQs, which may not be enough for chips with many peripherals. In that case additional interrupt controllers are cascaded to extend the number of interrupts; such an added interrupt controller (INTC) is called a level-2 interrupt controller. If one level-2 controller still isn't enough, you can use several of them, or add level-3 and level-4 interrupts. Of course, because multi-level interrupts must be dispatched in software, the more levels there are, the lower the efficiency.

### Related Macros

Because Zephyr's [multi-level interrupts](https://docs.zephyrproject.org/latest/kernel/other/interrupts.html) are generated statically, they're a bit more complex to implement. First, we need to understand what a few multi-level interrupt macros mean:

- CONFIG_MULTI_LEVEL_INTERRUPTS
Master switch for multi-level interrupts
- CONFIG_2ND_LEVEL_INTERRUPTS
Enables level-2 interrupts
- CONFIG_3RD_LEVEL_INTERRUPTS
Enables level-3 interrupts
- CONFIG_2ND_LVL_ISR_TBL_OFFSET
Offset of the level-2 vector table, i.e. the number of level-1 interrupts, since the level-2 vector table follows the level-1 table
- CONFIG_NUM_2ND_LEVEL_AGGREGATORS
Number of level-2 interrupt controllers
- CONFIG_MAX_IRQ_PER_AGGREGATOR
Maximum number of interrupts per multi-level interrupt controller; if controllers have different numbers of interrupts, use the largest
- CONFIG_2ND_LVL_INTR_00_OFFSET
Interrupt number of the first level-2 interrupt controller
- CONFIG_2ND_LVL_INTR_01_OFFSET
Interrupt number of the second level-2 interrupt controller

These macros configure multi-level interrupts, and the build scripts generate the interrupt vector table from them.

### Defining Interrupt Numbers

With single-level interrupts, the IRQ number passed to `IRQ_CONNECT` is simply the actual interrupt number. Multi-level interrupts involve an interrupt number at every level, so Zephyr packs the multi-level interrupt number into a DWORD, with one byte per level.

The diagram below, from the official documentation, shows how interrupt numbers are defined:

```
         9             2   0
   _ _ _ _ _ _ _ _ _ _ _ _ _          (LEVEL 1) 
         |         |   |
  5      |         A   |
_ _ _ _ _|_ _         _|_ _ _ _ _ _   (LEVEL 2)
  |   |                       |
  |   C                       B
 _|_ _ _ _ _ _                        (LEVEL 3)
         |
         D
```

Following the example, the interrupt numbers for devices A, B, C and D are defined as below. Note that only level-1 numbers start from 0; from level 2 on, all numbers start from 1, because 0 means "no device".

```
A -> 0x00000004
B -> 0x00000302
C -> 0x00000409
D -> 0x00030609
```

### Generating the Interrupt Vector Table

Now suppose the macros above are defined as follows:

```c
#define CONFIG_MULTI_LEVEL_INTERRUPTS 1
#define CONFIG_2ND_LEVEL_INTERRUPTS 1
#define CONFIG_3ND_LEVEL_INTERRUPTS 1
#define CONFIG_2ND_LVL_ISR_TBL_OFFSET 64
#define CONFIG_NUM_2ND_LEVEL_AGGREGATORS 2
#define CONFIG_MAX_IRQ_PER_AGGREGATOR 32
#define CONFIG_2ND_LVL_INTR_00_OFFSET 2
#define CONFIG_2ND_LVL_INTR_01_OFFSET 9
```

The system generates this interrupt vector table:

```
isr_table
     +---------+----------+
     |  isr0   |          |
     |  isr1   |          |
     |  isr2   |          |
     |  isr3   | LEVEL 1  |
=> A |  isr4   |          |
     |   ...   |          |
     |  isr63  |          |
     +---------+----------+
     |  isr64  |          |
     |  isr65  |          |
=> B |  isr66  | LEVEL 2  |
     |   ...   |          |
     |  isr95  |          |
     +---------+----------+
     |  isr96  |          |
     |  isr97  |          |
     |  isr98  |          |
=> C |  isr99  | LEVEL 2  |
     |   ...   |          |
     |  isr127 |          |
     +---------+----------+
     |  isr128 |          |
     |  isr129 |          |
=> D |  isr130 | LEVEL 3  |
     |   ...   |          |
     |  isr159 |          |
     +---------+----------+

```

### Registering Interrupts

Once the interrupt number is defined, registering a multi-level interrupt works just like registering a normal one. For example, to register the interrupt for device C above:

```c
IRQ_CONNECT(0x00000409, DEVICE_C_IRQ_PRIO, uwp_ictl_isr, 0, 0);
irq_enable(0x00000409);
```

This is just an example, so the number is written directly. In real code, hardware-related parameters should all be defined in the device tree, and the code should use the generated macros.

### Handling Interrupts

When a multi-level interrupt service routine fires, it has to dispatch interrupts based on the interrupt status register. The dispatch function needs the current interrupt status and the starting position of the current interrupt controller in `isr_table`, which can be read from the diagram above. Dispatch goes through each bit of the interrupt status in turn, ensuring every interrupt gets handled.

```c
static ALWAYS_INLINE void uwp_dispatch_child_isrs(u32_t intr_status,
                              u32_t isr_base_offset)
{
    u32_t intr_bitpos, intr_offset;

    /* Dispatch lower level ISRs depending upon the bit set */
    while (intr_status) {
        intr_bitpos = find_lsb_set(intr_status) - 1;
        intr_status &= ~(1 << intr_bitpos);
        intr_offset = isr_base_offset + intr_bitpos;
        _sw_isr_table[intr_offset].isr(
            _sw_isr_table[intr_offset].arg);
    }
}

static void uwp_ictl_isr(void *arg)
{
    struct device *dev = arg;

    struct uwp_ictl_config *config = DEV_CFG(dev);

    volatile struct uwp_intc *intc = INTC_STRUCT(dev);

    uwp_dispatch_child_isrs(uwp_intc_status(intc),
            config->isr_table_offset);
}
```

## Conclusion

Analyzing Zephyr's multi-level interrupt flow shows that Zephyr has already encapsulated most of the work. You only need to sort out the topology of the interrupt controllers in your system and write a small amount of code to handle multi-level interrupts.
