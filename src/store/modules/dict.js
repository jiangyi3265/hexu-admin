const useDictStore = defineStore(
  'dict',
  {
    state: () => ({
      dict: new Array()
    }),
    actions: {
      // 获取字典
      getDict(_key) {
        if (_key == null || _key === "") {
          return null
        }
        try {
          for (let i = 0; i < this.dict.length; i++) {
            if (this.dict[i].key == _key) {
              return this.dict[i].value
            }
          }
        } catch (e) {
          return null
        }
      },
      // 设置字典
      setDict(_key, value) {
        if (_key != null && _key !== "") {
          const existing = this.dict.find(item => item.key == _key)
          if (existing) {
            existing.value = value
            this.dict = this.dict.filter(item => item === existing || item.key != _key)
          } else this.dict.push({ key: _key, value })
        }
      },
      // 删除字典
      removeDict(_key) {
        var bln = false
        try {
          for (let i = 0; i < this.dict.length; i++) {
            if (this.dict[i].key == _key) {
              this.dict.splice(i, 1)
              return true
            }
          }
        } catch (e) {
          bln = false
        }
        return bln
      },
      // 清空字典
      cleanDict() {
        this.dict = new Array()
      },
      // 初始字典
      initDict() {
      }
    }
  })

export default useDictStore
